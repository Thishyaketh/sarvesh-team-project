"""SQLite database management and sample data seeding for CivicPulse."""

from __future__ import annotations

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Iterator

from PIL import Image, ImageDraw

from app.ai_module import compute_priority

BASE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BASE_DIR / "civicpulse.db"
UPLOAD_DIR = BASE_DIR / "uploads"
SAMPLE_IMG_DIR = UPLOAD_DIR / "samples"


def get_db_path() -> Path:
    env_path = os.environ.get("CIVICPULSE_DB_PATH")
    return Path(env_path) if env_path else DEFAULT_DB_PATH


@contextmanager
def get_connection() -> Iterator[sqlite3.Connection]:
    db_path = get_db_path()
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    """Create tables if they do not exist and seed initial sample reports."""
    UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    SAMPLE_IMG_DIR.mkdir(parents=True, exist_ok=True)

    with get_connection() as conn:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                description TEXT NOT NULL,
                location_label TEXT NOT NULL,
                approx_lat REAL NOT NULL,
                approx_lng REAL NOT NULL,
                image_path TEXT NOT NULL,
                category TEXT NOT NULL,
                ai_suggested_category TEXT NOT NULL,
                ai_confidence REAL NOT NULL,
                ai_notes TEXT NOT NULL DEFAULT '',
                needs_human_review INTEGER NOT NULL DEFAULT 1,
                status TEXT NOT NULL DEFAULT 'Submitted',
                duplicate_of_id INTEGER NULL,
                severity_s REAL NOT NULL DEFAULT 50,
                impact_i REAL NOT NULL DEFAULT 50,
                recurrence_r REAL NOT NULL DEFAULT 30,
                time_t REAL NOT NULL DEFAULT 20,
                priority_score REAL NOT NULL DEFAULT 42.0,
                priority_band TEXT NOT NULL DEFAULT 'MEDIUM',
                is_sample INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS review_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                report_id INTEGER NOT NULL,
                action TEXT NOT NULL,
                note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL,
                FOREIGN KEY (report_id) REFERENCES reports(id) ON DELETE CASCADE
            )
            """
        )

        count_row = conn.execute("SELECT COUNT(*) AS cnt FROM reports").fetchone()
        if count_row and count_row["cnt"] == 0:
            _seed_sample_reports(conn)


def _ensure_sample_image(filename: str, bg_color: tuple[int, int, int], label: str) -> str:
    """Create a clean, lightweight illustrative PNG for sample reports."""
    file_path = SAMPLE_IMG_DIR / filename
    if not file_path.exists():
        img = Image.new("RGB", (480, 320), color=bg_color)
        draw = ImageDraw.Draw(img)
        draw.rectangle([20, 20, 460, 300], outline=(255, 255, 255), width=3)
        draw.text((40, 130), f"SAMPLE ILLUSTRATION\n{label}", fill=(255, 255, 255))
        img.save(file_path, format="PNG")
    return f"/uploads/samples/{filename}"


def _seed_sample_reports(conn: sqlite3.Connection) -> None:
    now = datetime.now(timezone.utc)
    samples = [
        {
            "description": "Overflowing municipal waste bin near bus shelter with scattered plastic bags.",
            "location_label": "Ashok Pillar Bus Stop (Public Area)",
            "approx_lat": 13.0358,
            "approx_lng": 80.2121,
            "filename": "sample_garbage.png",
            "bg": (166, 94, 46),
            "label": "Overflowing Garbage Bin",
            "category": "Overflowing garbage bin",
            "ai_suggested_category": "Overflowing garbage bin",
            "ai_confidence": 0.78,
            "ai_notes": "Sample demonstration record.",
            "needs_human_review": 0,
            "status": "Verified",
            "s": 70, "i": 75, "r": 65, "t": 40,
            "hours_ago": 36,
        },
        {
            "description": "Continuous clean water pipe leakage pooling along the corner curb.",
            "location_label": "10th Avenue Junction, Ashok Nagar",
            "approx_lat": 13.0389,
            "approx_lng": 80.2145,
            "filename": "sample_water.png",
            "bg": (41, 108, 158),
            "label": "Water Leakage",
            "category": "Water leakage",
            "ai_suggested_category": "Water leakage",
            "ai_confidence": 0.72,
            "ai_notes": "Sample demonstration record.",
            "needs_human_review": 0,
            "status": "In Progress",
            "s": 80, "i": 82, "r": 70, "t": 60,
            "hours_ago": 48,
        },
        {
            "description": "Cracked and uneven footpath slabs creating a tripping hazard for pedestrians.",
            "location_label": "Near Kendriya Vidyalaya Main Gate Road",
            "approx_lat": 13.0369,
            "approx_lng": 80.2102,
            "filename": "sample_footpath.png",
            "bg": (110, 114, 120),
            "label": "Damaged Footpath",
            "category": "Damaged footpath / road",
            "ai_suggested_category": "Damaged footpath / road",
            "ai_confidence": 0.68,
            "ai_notes": "Sample demonstration record.",
            "needs_human_review": 0,
            "status": "Under Review",
            "s": 65, "i": 70, "r": 45, "t": 35,
            "hours_ago": 18,
        },
        {
            "description": "Two streetlights not working along the park walkway after 6:30 PM.",
            "location_label": "K.K. Nagar Park East Walkway",
            "approx_lat": 13.0401,
            "approx_lng": 80.2078,
            "filename": "sample_streetlight.png",
            "bg": (34, 42, 62),
            "label": "Streetlight Problem",
            "category": "Streetlight problem",
            "ai_suggested_category": "Streetlight problem",
            "ai_confidence": 0.74,
            "ai_notes": "Sample demonstration record.",
            "needs_human_review": 0,
            "status": "Submitted",
            "s": 60, "i": 65, "r": 50, "t": 25,
            "hours_ago": 10,
        },
        {
            "description": "Blurry evening photo near market lane; unclear if drainage cover or road patch.",
            "location_label": "4th Avenue Market Corner",
            "approx_lat": 13.0345,
            "approx_lng": 80.2153,
            "filename": "sample_uncertain.png",
            "bg": (92, 96, 86),
            "label": "Needs Human Review",
            "category": "Other / Not sure",
            "ai_suggested_category": "Other / Not sure",
            "ai_confidence": 0.41,
            "ai_notes": "Confidence (41%) is below 60% review threshold.",
            "needs_human_review": 1,
            "status": "Under Review",
            "s": 40, "i": 45, "r": 20, "t": 15,
            "hours_ago": 6,
        },
        {
            "description": "Waste bin cleared and area swept after community drive.",
            "location_label": "Jafferkhanpet Main Road Bus Bay",
            "approx_lat": 13.0312,
            "approx_lng": 80.2091,
            "filename": "sample_resolved.png",
            "bg": (58, 128, 88),
            "label": "Resolved Sample",
            "category": "Overflowing garbage bin",
            "ai_suggested_category": "Overflowing garbage bin",
            "ai_confidence": 0.81,
            "ai_notes": "Sample demonstration record.",
            "needs_human_review": 0,
            "status": "Resolved",
            "s": 20, "i": 25, "r": 15, "t": 10,
            "hours_ago": 72,
        },
    ]

    for item in samples:
        img_url = _ensure_sample_image(item["filename"], item["bg"], item["label"])
        p_score, p_band = compute_priority(item["s"], item["i"], item["r"], item["t"])
        ts = (now - timedelta(hours=item["hours_ago"])).isoformat()
        conn.execute(
            """
            INSERT INTO reports (
                description, location_label, approx_lat, approx_lng, image_path,
                category, ai_suggested_category, ai_confidence, ai_notes,
                needs_human_review, status, duplicate_of_id,
                severity_s, impact_i, recurrence_r, time_t,
                priority_score, priority_band, is_sample, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, 1, ?, ?)
            """,
            (
                item["description"],
                item["location_label"],
                item["approx_lat"],
                item["approx_lng"],
                img_url,
                item["category"],
                item["ai_suggested_category"],
                item["ai_confidence"],
                item["ai_notes"],
                item["needs_human_review"],
                item["status"],
                item["s"],
                item["i"],
                item["r"],
                item["t"],
                p_score,
                p_band,
                ts,
                ts,
            ),
        )
