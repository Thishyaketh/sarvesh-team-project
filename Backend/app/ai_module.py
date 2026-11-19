"""Unified AI Module facade for CivicPulse."""

from __future__ import annotations

from typing import Any

from app.ai_nlp import estimate_initial_priority_factors, find_similar_reports_nlp
from app.ai_vision import (
    blur_faces_if_available,
    classify_image_ml,
    extract_cv_features,
    get_evaluation_report,
    train_and_evaluate_model,
)
from app.constants import PRIORITY_BANDS, PRIORITY_WEIGHTS


def compute_priority(s: float, i: float, r: float, t: float) -> tuple[float, str]:
    """Compute illustrative attention score P = 0.35S + 0.30I + 0.20R + 0.15T."""
    s_clamped = max(0.0, min(100.0, float(s)))
    i_clamped = max(0.0, min(100.0, float(i)))
    r_clamped = max(0.0, min(100.0, float(r)))
    t_clamped = max(0.0, min(100.0, float(t)))

    score = (
        PRIORITY_WEIGHTS["S"] * s_clamped
        + PRIORITY_WEIGHTS["I"] * i_clamped
        + PRIORITY_WEIGHTS["R"] * r_clamped
        + PRIORITY_WEIGHTS["T"] * t_clamped
    )
    score = round(score, 1)

    band = "LOW"
    for b in PRIORITY_BANDS:
        if b["min"] <= score <= b["max"]:
            band = b["label"]
            break
    if score > 100:
        band = "CRITICAL"
    return score, band


def classify_image(
    image_bytes: bytes,
    filename: str = "",
    description: str = "",
) -> dict[str, Any]:
    return classify_image_ml(image_bytes, filename=filename, description=description)


def find_similar_reports(
    description: str,
    location_label: str,
    existing_reports: list[dict[str, Any]],
    approx_lat: float | None = None,
    approx_lng: float | None = None,
    top_k: int = 3,
    threshold: float = 0.18,
) -> list[dict[str, Any]]:
    return find_similar_reports_nlp(
        description=description,
        location_label=location_label,
        existing_reports=existing_reports,
        approx_lat=approx_lat,
        approx_lng=approx_lng,
        top_k=top_k,
        threshold=threshold,
    )


__all__ = [
    "blur_faces_if_available",
    "classify_image",
    "compute_priority",
    "estimate_initial_priority_factors",
    "extract_cv_features",
    "find_similar_reports",
    "get_evaluation_report",
    "train_and_evaluate_model",
]
