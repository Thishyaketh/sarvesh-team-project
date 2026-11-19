"""Computer Vision & Machine Learning module for CivicPulse.

Uses OpenCV (cv2), NumPy, and scikit-learn (RandomForestClassifier) trained on
a separated train/test prototype feature dataset, with explicit uncertainty
handling ('Other / Not sure' + 'Needs human review').
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import cv2
import joblib
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from app.constants import CATEGORIES, CONFIDENCE_REVIEW_THRESHOLD

BASE_DIR = Path(__file__).resolve().parent.parent
MODELS_DIR = BASE_DIR / "models"
MODEL_PATH = MODELS_DIR / "civic_vision_model.joblib"
EVAL_PATH = MODELS_DIR / "evaluation_report.json"

TRAIN_CATEGORIES = [
    "Overflowing garbage bin",
    "Water leakage",
    "Damaged footpath / road",
    "Streetlight problem",
]

FEATURE_NAMES = [
    "brightness",
    "saturation",
    "blur_variance",
    "edge_density",
    "dark_ratio",
    "bright_spot_ratio",
    "blue_cyan_ratio",
    "warm_clutter_ratio",
    "gray_surface_ratio",
    "value_std",
]

CATEGORY_KEYWORDS: dict[str, set[str]] = {
    "Overflowing garbage bin": {
        "garbage", "trash", "waste", "bin", "dustbin", "litter", "overflow",
        "overflowing", "dump", "plastic", "smell", "rubbish", "cleanliness",
    },
    "Water leakage": {
        "water", "leak", "leaking", "leakage", "pipe", "puddle", "flood",
        "flooded", "drain", "sewage", "tap", "burst", "wet",
    },
    "Damaged footpath / road": {
        "footpath", "pavement", "sidewalk", "pothole", "crack", "cracked",
        "broken", "damaged", "road", "asphalt", "slab", "uneven", "walking",
    },
    "Streetlight problem": {
        "streetlight", "light", "lamp", "bulb", "dark", "flickering", "pole",
        "unlit", "night", "electric", "glow", "dead",
    },
}


def blur_faces_if_available(image_bytes: bytes) -> tuple[bytes, int]:
    """Blur human faces using OpenCV Haar cascade if the cascade file is present."""
    cascade_path = os.path.join(
        getattr(cv2.data, "haarcascades", ""),
        "haarcascade_frontalface_default.xml",
    )
    if not cascade_path or not os.path.exists(cascade_path):
        return image_bytes, 0

    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return image_bytes, 0

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(cascade_path)
    faces = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(24, 24))
    if len(faces) == 0:
        return image_bytes, 0

    for (x, y, w, h) in faces:
        roi = img[y : y + h, x : x + w]
        img[y : y + h, x : x + w] = cv2.GaussianBlur(roi, (51, 51), 30)

    ok, encoded = cv2.imencode(".png", img)
    if not ok:
        return image_bytes, 0
    return encoded.tobytes(), int(len(faces))


def extract_cv_features(image_bytes: bytes) -> tuple[np.ndarray, dict[str, float], tuple[int, int]]:
    """Extract OpenCV visual features from raw image bytes."""
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Could not decode image with OpenCV.")

    orig_h, orig_w = img.shape[:2]
    resized = cv2.resize(img, (128, 128), interpolation=cv2.INTER_AREA)
    hsv = cv2.cvtColor(resized, cv2.COLOR_BGR2HSV)
    gray = cv2.cvtColor(resized, cv2.COLOR_BGR2GRAY)

    h_ch, s_ch, v_ch = cv2.split(hsv)
    brightness = float(np.mean(v_ch) / 255.0)
    saturation = float(np.mean(s_ch) / 255.0)
    value_std = float(np.std(v_ch) / 128.0)

    laplacian_var = float(cv2.Laplacian(gray, cv2.CV_64F).var())
    edges = cv2.Canny(gray, 80, 180)
    edge_density = float(np.mean(edges > 0))

    dark_ratio = float(np.mean(v_ch < 50))
    bright_spot_ratio = float(np.mean(v_ch > 220))
    blue_cyan_ratio = float(np.mean((h_ch >= 85) & (h_ch <= 130) & (s_ch > 40)))
    warm_clutter_ratio = float(np.mean(((h_ch <= 30) | (h_ch >= 165)) & (s_ch > 50)))
    gray_surface_ratio = float(np.mean(s_ch < 45))

    feature_vec = np.array(
        [
            brightness,
            saturation,
            min(laplacian_var / 500.0, 2.0),
            edge_density,
            dark_ratio,
            bright_spot_ratio,
            blue_cyan_ratio,
            warm_clutter_ratio,
            gray_surface_ratio,
            min(value_std, 1.5),
        ],
        dtype=np.float32,
    )

    metrics = {
        "width": float(orig_w),
        "height": float(orig_h),
        "brightness": round(brightness, 3),
        "saturation": round(saturation, 3),
        "blur_variance": round(laplacian_var, 1),
        "edge_density": round(edge_density, 3),
        "dark_ratio": round(dark_ratio, 3),
        "blue_cyan_ratio": round(blue_cyan_ratio, 3),
        "gray_surface_ratio": round(gray_surface_ratio, 3),
    }
    return feature_vec, metrics, (orig_w, orig_h)


def _generate_prototype_dataset(n_per_class: int, seed: int) -> tuple[np.ndarray, list[str]]:
    """Generate labelled synthetic feature vectors for prototype training/testing."""
    rng = np.random.default_rng(seed)
    X_list: list[np.ndarray] = []
    y_list: list[str] = []

    # Feature order matches FEATURE_NAMES
    profiles = {
        "Overflowing garbage bin": (
            [0.52, 0.48, 0.65, 0.28, 0.12, 0.06, 0.05, 0.42, 0.25, 0.45],
            [0.12, 0.14, 0.25, 0.08, 0.08, 0.05, 0.04, 0.14, 0.12, 0.12],
        ),
        "Water leakage": (
            [0.55, 0.42, 0.45, 0.14, 0.10, 0.18, 0.45, 0.08, 0.30, 0.32],
            [0.12, 0.12, 0.20, 0.06, 0.07, 0.10, 0.15, 0.06, 0.12, 0.10],
        ),
        "Damaged footpath / road": (
            [0.48, 0.16, 0.78, 0.34, 0.15, 0.04, 0.04, 0.10, 0.74, 0.36],
            [0.10, 0.08, 0.25, 0.09, 0.08, 0.04, 0.03, 0.06, 0.12, 0.10],
        ),
        "Streetlight problem": (
            [0.18, 0.22, 0.35, 0.10, 0.72, 0.16, 0.08, 0.12, 0.35, 0.42],
            [0.08, 0.10, 0.18, 0.05, 0.14, 0.10, 0.05, 0.08, 0.15, 0.14],
        ),
    }

    for label, (means, stds) in profiles.items():
        samples = rng.normal(loc=means, scale=stds, size=(n_per_class, len(FEATURE_NAMES)))
        samples = np.clip(samples, 0.0, 2.0).astype(np.float32)
        X_list.append(samples)
        y_list.extend([label] * n_per_class)

    return np.vstack(X_list), y_list


def train_and_evaluate_model(extra_samples: list[tuple[np.ndarray, str]] | None = None) -> dict[str, Any]:
    """Train RandomForest model on train split and evaluate on unseen test split."""
    MODELS_DIR.mkdir(parents=True, exist_ok=True)

    X_train, y_train = _generate_prototype_dataset(n_per_class=60, seed=101)
    X_test, y_test = _generate_prototype_dataset(n_per_class=20, seed=999)

    if extra_samples:
        extra_X = np.vstack([s[0] for s in extra_samples])
        extra_y = [s[1] for s in extra_samples]
        X_train = np.vstack([X_train, extra_X])
        y_train.extend(extra_y)

    pipeline = Pipeline(
        [
            ("scaler", StandardScaler()),
            ("clf", RandomForestClassifier(n_estimators=120, max_depth=8, random_state=42)),
        ]
    )
    pipeline.fit(X_train, y_train)

    y_pred = pipeline.predict(X_test)
    acc = round(float(accuracy_score(y_test, y_pred)), 4)
    report_dict = classification_report(y_test, y_pred, output_dict=True, zero_division=0)
    cm = confusion_matrix(y_test, y_pred, labels=TRAIN_CATEGORIES).tolist()

    eval_summary = {
        "model_name": "RandomForestClassifier (OpenCV 10-feature CV Pipeline)",
        "dataset_note": "Evaluated on separated synthetic/staged prototype test split (not field trials).",
        "train_samples": len(y_train),
        "test_samples": len(y_test),
        "verified_feedback_samples": len(extra_samples) if extra_samples else 0,
        "test_accuracy": acc,
        "categories": TRAIN_CATEGORIES,
        "per_category_metrics": {
            cat: {
                "precision": round(float(report_dict[cat]["precision"]), 3),
                "recall": round(float(report_dict[cat]["recall"]), 3),
                "f1": round(float(report_dict[cat]["f1-score"]), 3),
            }
            for cat in TRAIN_CATEGORIES
            if cat in report_dict
        },
        "confusion_matrix": cm,
        "trained_at": datetime.now(timezone.utc).isoformat(),
    }

    joblib.dump(pipeline, MODEL_PATH)
    EVAL_PATH.write_text(json.dumps(eval_summary, indent=2), encoding="utf-8")
    return eval_summary


def get_or_train_model() -> Pipeline:
    if not MODEL_PATH.exists():
        train_and_evaluate_model()
    return joblib.load(MODEL_PATH)


def get_evaluation_report() -> dict[str, Any]:
    if not EVAL_PATH.exists():
        return train_and_evaluate_model()
    return json.loads(EVAL_PATH.read_text(encoding="utf-8"))


def classify_image_ml(
    image_bytes: bytes,
    filename: str = "",
    description: str = "",
) -> dict[str, Any]:
    """Run trained RandomForest CV classifier + keyword cues with uncertainty flag."""
    feature_vec, metrics, (width, height) = extract_cv_features(image_bytes)
    model = get_or_train_model()

    probs = model.predict_proba(feature_vec.reshape(1, -1))[0]
    classes = list(model.classes_)
    prob_map: dict[str, float] = {cls: float(p) for cls, p in zip(classes, probs)}

    # Lightweight text cue fusion (capped so visual model remains primary)
    text_tokens = set(
        "".join(c if c.isalnum() else " " for c in f"{filename} {description}".lower()).split()
    )
    for cat, keywords in CATEGORY_KEYWORDS.items():
        if cat in prob_map:
            overlap = len(text_tokens & keywords)
            if overlap > 0:
                prob_map[cat] = min(0.95, prob_map[cat] + min(0.20, 0.08 * overlap))

    total_p = sum(prob_map.values())
    if total_p > 0:
        prob_map = {k: round(v / total_p, 3) for k, v in prob_map.items()}

    best_cat = max(prob_map, key=lambda k: prob_map[k])
    confidence = round(float(prob_map[best_cat]), 2)

    too_small = width < 64 or height < 64
    too_blurry = metrics["blur_variance"] < 20.0
    low_confidence = confidence < CONFIDENCE_REVIEW_THRESHOLD

    needs_human_review = too_small or too_blurry or low_confidence
    if too_small or too_blurry or confidence < 0.35:
        suggested_category = "Other / Not sure"
        needs_human_review = True
    else:
        suggested_category = best_cat

    reasons: list[str] = []
    if too_small:
        reasons.append("Image resolution is very low (<64px).")
    if too_blurry:
        reasons.append(f"Image appears blurry (Laplacian variance {metrics['blur_variance']}).")
    if low_confidence:
        reasons.append(
            f"Model confidence ({int(confidence * 100)}%) is below {int(CONFIDENCE_REVIEW_THRESHOLD * 100)}% review threshold."
        )
    if not reasons:
        reasons.append("OpenCV + RandomForest suggestion; human verification still recommended.")

    return {
        "suggested_category": suggested_category,
        "confidence": confidence,
        "needs_human_review": needs_human_review,
        "class_probabilities": prob_map,
        "visual_features": metrics,
        "analysis_notes": " ".join(reasons),
        "model_type": "OpenCV Feature Extractor + scikit-learn RandomForestClassifier",
    }
