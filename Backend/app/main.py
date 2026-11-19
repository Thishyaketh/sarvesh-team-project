"""FastAPI backend for CivicPulse — AI-Assisted Community Problem Detection and Reporting."""

from __future__ import annotations

import os
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.ai_module import (
    blur_faces_if_available,
    classify_image,
    compute_priority,
    estimate_initial_priority_factors,
    extract_cv_features,
    find_similar_reports,
    get_evaluation_report,
    train_and_evaluate_model,
)
from app.constants import (
    ALLOWED_IMAGE_EXTENSIONS,
    CATEGORIES,
    CONFIDENCE_REVIEW_THRESHOLD,
    DEFAULT_CENTER_LAT,
    DEFAULT_CENTER_LNG,
    MAX_IMAGE_SIZE_BYTES,
    PRIORITY_BANDS,
    PRIORITY_WEIGHTS,
    STATUSES,
)
from app.database import BASE_DIR, UPLOAD_DIR, get_connection, init_db


@asynccontextmanager
async def lifespan(_app: FastAPI):
    init_db()
    yield


app = FastAPI(
    title="CivicPulse API",
    description="Prototype backend for CivicPulse (RSBVP 2026-27).",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")


class ReviewUpdate(BaseModel):
    category: Optional[str] = None
    status: Optional[str] = None
    needs_human_review: Optional[bool] = None
    duplicate_of_id: Optional[int] = None
    clear_duplicate: bool = False
    severity_s: Optional[float] = Field(default=None, ge=0, le=100)
    impact_i: Optional[float] = Field(default=None, ge=0, le=100)
    recurrence_r: Optional[float] = Field(default=None, ge=0, le=100)
    time_t: Optional[float] = Field(default=None, ge=0, le=100)
    reviewer_note: str = ""


def _row_to_dict(row: Any) -> dict[str, Any]:
    d = dict(row)
    d["needs_human_review"] = bool(d["needs_human_review"])
    d["is_sample"] = bool(d["is_sample"])
    return d


def _validate_and_read_image(photo: UploadFile, content: bytes) -> str:
    filename = photo.filename or "upload.jpg"
    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_IMAGE_EXTENSIONS))}.",
        )
    if len(content) == 0:
        raise HTTPException(status_code=400, detail="Uploaded image file is empty.")
    if len(content) > MAX_IMAGE_SIZE_BYTES:
        raise HTTPException(
            status_code=400,
            detail=f"Image exceeds maximum allowed size of {MAX_IMAGE_SIZE_BYTES // (1024 * 1024)} MB.",
        )
    return ext


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok", "service": "civicpulse-backend"}


@app.get("/api/meta")
def get_meta() -> dict[str, Any]:
    return {
        "categories": CATEGORIES,
        "statuses": STATUSES,
        "priority_weights": PRIORITY_WEIGHTS,
        "priority_bands": PRIORITY_BANDS,
        "confidence_review_threshold": CONFIDENCE_REVIEW_THRESHOLD,
        "default_center": {"lat": DEFAULT_CENTER_LAT, "lng": DEFAULT_CENTER_LNG},
        "feature_labels": {
            "report_submission": "working",
            "sqlite_persistence": "working",
            "image_ai_classifier": "simulated_baseline",
            "text_similarity_matching": "working",
            "human_review_queue": "working",
            "openstreetmap_display": "working",
            "sample_seed_records": "sample",
        },
        "disclaimers": {
            "ai": "AI suggestions are assistive only and may be wrong. A human reviewer checks uncertain or important reports.",
            "priority": "Illustrative bands only — not an official rating, validated standard, or automatic dispatch signal.",
            "privacy": "Collect only needed civic details. Use approximate public locations rather than exact home addresses.",
        },
    }


@app.get("/api/stats")
def get_stats(include_sample: bool = True) -> dict[str, Any]:
    with get_connection() as conn:
        where = "" if include_sample else "WHERE is_sample = 0"
        rows = [_row_to_dict(r) for r in conn.execute(f"SELECT * FROM reports {where}").fetchall()]

    category_counts = {c: 0 for c in CATEGORIES}
    status_counts = {s: 0 for s in STATUSES}
    priority_counts = {b["label"]: 0 for b in PRIORITY_BANDS}

    needs_review_count = 0
    sample_count = 0
    live_count = 0

    for r in rows:
        if r["category"] in category_counts:
            category_counts[r["category"]] += 1
        if r["status"] in status_counts:
            status_counts[r["status"]] += 1
        if r["priority_band"] in priority_counts:
            priority_counts[r["priority_band"]] += 1
        if r["needs_human_review"]:
            needs_review_count += 1
        if r["is_sample"]:
            sample_count += 1
        else:
            live_count += 1

    return {
        "total_reports": len(rows),
        "sample_count": sample_count,
        "live_count": live_count,
        "needs_human_review_count": needs_review_count,
        "category_counts": category_counts,
        "status_counts": status_counts,
        "priority_counts": priority_counts,
    }


@app.get("/api/reports")
def list_reports(
    category: Optional[str] = None,
    status: Optional[str] = None,
    needs_review: Optional[bool] = None,
    search: Optional[str] = None,
    include_sample: bool = Query(default=True),
) -> dict[str, Any]:
    clauses: list[str] = []
    params: list[Any] = []

    if not include_sample:
        clauses.append("is_sample = 0")
    if category and category != "All":
        clauses.append("category = ?")
        params.append(category)
    if status and status != "All":
        clauses.append("status = ?")
        params.append(status)
    if needs_review is not None:
        clauses.append("needs_human_review = ?")
        params.append(1 if needs_review else 0)
    if search and search.strip():
        q = f"%{search.strip()}%"
        clauses.append("(description LIKE ? OR location_label LIKE ?)")
        params.extend([q, q])

    where_sql = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    sql = f"SELECT * FROM reports {where_sql} ORDER BY priority_score DESC, created_at DESC"

    with get_connection() as conn:
        rows = [_row_to_dict(r) for r in conn.execute(sql, params).fetchall()]
    return {"reports": rows, "count": len(rows)}


@app.get("/api/reports/{report_id}")
def get_report(report_id: int) -> dict[str, Any]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found.")
        report = _row_to_dict(row)
        other_rows = [
            _row_to_dict(r)
            for r in conn.execute("SELECT * FROM reports WHERE id != ?", (report_id,)).fetchall()
        ]
        logs = [
            dict(l)
            for l in conn.execute(
                "SELECT * FROM review_logs WHERE report_id = ? ORDER BY created_at DESC",
                (report_id,),
            ).fetchall()
        ]

    similar = find_similar_reports(
        report["description"],
        report["location_label"],
        other_rows,
        approx_lat=report["approx_lat"],
        approx_lng=report["approx_lng"],
    )
    return {"report": report, "similar_reports": similar, "review_logs": logs}


@app.post("/api/analyze")
async def analyze_preview(
    photo: UploadFile = File(...),
    description: str = Form(default=""),
    location_label: str = Form(default=""),
    approx_lat: float = Form(default=DEFAULT_CENTER_LAT),
    approx_lng: float = Form(default=DEFAULT_CENTER_LNG),
) -> dict[str, Any]:
    """Run AI image classification and text-similarity check without saving."""
    content = await photo.read()
    _validate_and_read_image(photo, content)

    try:
        _, faces_blurred = blur_faces_if_available(content)
        ai_result = classify_image(content, photo.filename or "", description)
        ai_result["privacy_faces_blurred"] = faces_blurred
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Invalid or corrupted image: {exc}") from exc

    with get_connection() as conn:
        existing = [_row_to_dict(r) for r in conn.execute("SELECT * FROM reports").fetchall()]

    similar = find_similar_reports(
        description,
        location_label,
        existing,
        approx_lat=round(float(approx_lat), 4),
        approx_lng=round(float(approx_lng), 4),
    )
    return {"ai_check": ai_result, "similar_reports": similar}


@app.post("/api/reports", status_code=201)
async def create_report(
    photo: UploadFile = File(...),
    description: str = Form(...),
    location_label: str = Form(...),
    approx_lat: float = Form(default=DEFAULT_CENTER_LAT),
    approx_lng: float = Form(default=DEFAULT_CENTER_LNG),
    user_category: Optional[str] = Form(default=None),
) -> dict[str, Any]:
    desc_clean = description.strip()
    loc_clean = location_label.strip()
    if len(desc_clean) < 5:
        raise HTTPException(
            status_code=400,
            detail="Please enter a short description (at least 5 characters).",
        )
    if len(loc_clean) < 3:
        raise HTTPException(
            status_code=400,
            detail="Please enter an approximate public location or landmark.",
        )

    content = await photo.read()
    ext = _validate_and_read_image(photo, content)

    try:
        processed_content, faces_blurred = blur_faces_if_available(content)
        ai_result = classify_image(processed_content, photo.filename or "", desc_clean)
        ai_result["privacy_faces_blurred"] = faces_blurred
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Could not read image file: {exc}") from exc

    # Save uploaded image (with any detected faces blurred)
    saved_name = f"{uuid.uuid4().hex}{ext}"
    saved_path = UPLOAD_DIR / saved_name
    saved_path.write_bytes(processed_content)
    image_url = f"/uploads/{saved_name}"

    # Determine initial category (user correction overrides AI suggestion)
    chosen_category = ai_result["suggested_category"]
    if user_category and user_category in CATEGORIES:
        chosen_category = user_category

    # Approximate public coordinates rounded to 4 decimals (~11m-100m grid)
    safe_lat = round(float(approx_lat), 4)
    safe_lng = round(float(approx_lng), 4)

    with get_connection() as conn:
        existing = [_row_to_dict(r) for r in conn.execute("SELECT * FROM reports").fetchall()]
        similar = find_similar_reports(
            desc_clean,
            loc_clean,
            existing,
            approx_lat=safe_lat,
            approx_lng=safe_lng,
        )

        # Initial illustrative priority factors using NLP urgency cues
        recurrence_r = min(100.0, 25.0 + 25.0 * len(similar))
        s_init, i_init = estimate_initial_priority_factors(desc_clean, loc_clean)
        t_init = 15.0
        p_score, p_band = compute_priority(s_init, i_init, recurrence_r, t_init)

        needs_review = 1 if (ai_result["needs_human_review"] or chosen_category == "Other / Not sure") else 0
        now_iso = datetime.now(timezone.utc).isoformat()

        cursor = conn.execute(
            """
            INSERT INTO reports (
                description, location_label, approx_lat, approx_lng, image_path,
                category, ai_suggested_category, ai_confidence, ai_notes,
                needs_human_review, status, duplicate_of_id,
                severity_s, impact_i, recurrence_r, time_t,
                priority_score, priority_band, is_sample, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Submitted', NULL, ?, ?, ?, ?, ?, ?, 0, ?, ?)
            """,
            (
                desc_clean,
                loc_clean,
                safe_lat,
                safe_lng,
                image_url,
                chosen_category,
                ai_result["suggested_category"],
                ai_result["confidence"],
                ai_result["analysis_notes"],
                needs_review,
                s_init,
                i_init,
                recurrence_r,
                t_init,
                p_score,
                p_band,
                now_iso,
                now_iso,
            ),
        )
        new_id = cursor.lastrowid
        conn.execute(
            "INSERT INTO review_logs (report_id, action, note, created_at) VALUES (?, ?, ?, ?)",
            (new_id, "Submitted", f"AI suggested '{ai_result['suggested_category']}' ({int(ai_result['confidence']*100)}%).", now_iso),
        )
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (new_id,)).fetchone()

    return {
        "report": _row_to_dict(row),
        "ai_check": ai_result,
        "similar_reports": similar,
    }


@app.patch("/api/reports/{report_id}/review")
def review_report(report_id: int, payload: ReviewUpdate) -> dict[str, Any]:
    if payload.category is not None and payload.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail="Invalid category.")
    if payload.status is not None and payload.status not in STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status.")

    with get_connection() as conn:
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found.")
        current = _row_to_dict(row)

        new_category = payload.category if payload.category is not None else current["category"]
        new_status = payload.status if payload.status is not None else current["status"]
        new_needs_review = (
            int(payload.needs_human_review)
            if payload.needs_human_review is not None
            else (1 if current["needs_human_review"] else 0)
        )

        if payload.clear_duplicate:
            new_dup = None
        elif payload.duplicate_of_id is not None:
            if payload.duplicate_of_id == report_id:
                raise HTTPException(status_code=400, detail="Report cannot be a duplicate of itself.")
            new_dup = payload.duplicate_of_id
        else:
            new_dup = current["duplicate_of_id"]

        s = payload.severity_s if payload.severity_s is not None else current["severity_s"]
        i = payload.impact_i if payload.impact_i is not None else current["impact_i"]
        r = payload.recurrence_r if payload.recurrence_r is not None else current["recurrence_r"]
        t = payload.time_t if payload.time_t is not None else current["time_t"]
        p_score, p_band = compute_priority(s, i, r, t)

        now_iso = datetime.now(timezone.utc).isoformat()
        conn.execute(
            """
            UPDATE reports
            SET category = ?, status = ?, needs_human_review = ?, duplicate_of_id = ?,
                severity_s = ?, impact_i = ?, recurrence_r = ?, time_t = ?,
                priority_score = ?, priority_band = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                new_category,
                new_status,
                new_needs_review,
                new_dup,
                s,
                i,
                r,
                t,
                p_score,
                p_band,
                now_iso,
                report_id,
            ),
        )

        action_summary = f"Review updated: status={new_status}, category={new_category}, P={p_score} ({p_band})"
        conn.execute(
            "INSERT INTO review_logs (report_id, action, note, created_at) VALUES (?, ?, ?, ?)",
            (report_id, action_summary, payload.reviewer_note.strip(), now_iso),
        )
        updated_row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()

    return {"report": _row_to_dict(updated_row)}


@app.delete("/api/reports/{report_id}")
def delete_report(report_id: int) -> dict[str, str]:
    with get_connection() as conn:
        row = conn.execute("SELECT * FROM reports WHERE id = ?", (report_id,)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Report not found.")
        conn.execute("DELETE FROM reports WHERE id = ?", (report_id,))
    return {"deleted": str(report_id)}


@app.get("/api/ai/evaluation")
def ai_evaluation() -> dict[str, Any]:
    """Return train/test split evaluation metrics for the prototype CV classifier."""
    return get_evaluation_report()


@app.post("/api/ai/retrain")
def ai_retrain() -> dict[str, Any]:
    """Retrain the CV classifier incorporating verified live reports from SQLite."""
    extra_samples = []
    with get_connection() as conn:
        rows = conn.execute(
            """
            SELECT image_path, category FROM reports
            WHERE is_sample = 0
              AND status IN ('Verified', 'In Progress', 'Resolved')
              AND category != 'Other / Not sure'
            """
        ).fetchall()

    for row in rows:
        rel = str(row["image_path"]).lstrip("/")
        img_file = BASE_DIR / rel
        if img_file.exists():
            try:
                vec, _, _ = extract_cv_features(img_file.read_bytes())
                extra_samples.append((vec, row["category"]))
            except Exception:
                continue

    return train_and_evaluate_model(extra_samples=extra_samples)
