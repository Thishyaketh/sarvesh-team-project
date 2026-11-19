"""Evaluation tests for CivicPulse backend (aligned with PDF Page 8 Evaluation Plan)."""

from __future__ import annotations

import io
import os
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from app.ai_module import compute_priority
from app.main import app


def _make_png_bytes(color: tuple[int, int, int] = (40, 120, 200), size: tuple[int, int] = (128, 128)) -> bytes:
    buf = io.BytesIO()
    img = Image.new("RGB", size, color=color)
    # Add some variation so contrast isn't 0 unless intended
    for x in range(0, size[0], 4):
        for y in range(0, size[1], 4):
            img.putpixel((x, y), (min(255, color[0] + 40), color[1], max(0, color[2] - 40)))
    img.save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture()
def client(tmp_path: Path):
    db_file = tmp_path / "test_civicpulse.db"
    os.environ["CIVICPULSE_DB_PATH"] = str(db_file)
    with TestClient(app) as test_client:
        yield test_client
    os.environ.pop("CIVICPULSE_DB_PATH", None)


def test_health_and_seeded_samples(client: TestClient):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    stats = client.get("/api/stats").json()
    assert stats["sample_count"] == 6
    assert stats["live_count"] == 0


def test_invalid_upload_and_missing_fields(client: TestClient):
    # Invalid file extension
    res = client.post(
        "/api/reports",
        files={"photo": ("malware.txt", b"not an image", "text/plain")},
        data={"description": "Broken streetlight", "location_label": "Ashok Pillar"},
    )
    assert res.status_code == 400

    # Short/missing description
    res2 = client.post(
        "/api/reports",
        files={"photo": ("test.png", _make_png_bytes(), "image/png")},
        data={"description": "hi", "location_label": "Ashok Pillar"},
    )
    assert res2.status_code == 400


def test_uncertain_image_flags_human_review(client: TestClient):
    # Very small / uniform image should trigger 'Other / Not sure' & needs_human_review
    buf = io.BytesIO()
    Image.new("RGB", (32, 32), color=(128, 128, 128)).save(buf, format="PNG")
    res = client.post(
        "/api/reports",
        files={"photo": ("unclear.png", buf.getvalue(), "image/png")},
        data={
            "description": "Something unclear near the corner",
            "location_label": "4th Avenue Public Corner",
            "approx_lat": "13.03512345",
            "approx_lng": "80.21234567",
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["ai_check"]["suggested_category"] == "Other / Not sure"
    assert body["ai_check"]["needs_human_review"] is True
    # Coordinates rounded to 4 decimals for privacy
    assert body["report"]["approx_lat"] == 13.0351
    assert body["report"]["approx_lng"] == 80.2123


def test_duplicate_suggestion_without_auto_merge(client: TestClient):
    res = client.post(
        "/api/reports",
        files={"photo": ("garbage.png", _make_png_bytes((160, 90, 40)), "image/png")},
        data={
            "description": "Overflowing municipal waste bin near bus shelter with plastic bags",
            "location_label": "Ashok Pillar Bus Stop",
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert len(body["similar_reports"]) >= 1
    # Must NOT auto-merge
    assert body["report"]["duplicate_of_id"] is None


def test_priority_formula_and_human_review_update(client: TestClient):
    score, band = compute_priority(80, 90, 70, 60)
    # 0.35*80 + 0.30*90 + 0.20*70 + 0.15*60 = 28 + 27 + 14 + 9 = 78.0 -> HIGH
    assert score == 78.0
    assert band == "HIGH"

    reports = client.get("/api/reports").json()["reports"]
    target_id = reports[0]["id"]
    rev = client.patch(
        f"/api/reports/{target_id}/review",
        json={
            "category": "Water leakage",
            "status": "Verified",
            "needs_human_review": False,
            "severity_s": 80,
            "impact_i": 90,
            "recurrence_r": 70,
            "time_t": 60,
            "reviewer_note": "Verified by student volunteer.",
        },
    )
    assert rev.status_code == 200
    updated = rev.json()["report"]
    assert updated["category"] == "Water leakage"
    assert updated["status"] == "Verified"
    assert updated["priority_score"] == 78.0
    assert updated["priority_band"] == "HIGH"


def test_ai_evaluation_and_retrain(client: TestClient):
    ev = client.get("/api/ai/evaluation")
    assert ev.status_code == 200
    data = ev.json()
    assert data["train_samples"] >= 240
    assert data["test_samples"] >= 80
    assert 0.0 <= data["test_accuracy"] <= 1.0
    assert len(data["confusion_matrix"]) == 4

    retrain = client.post("/api/ai/retrain")
    assert retrain.status_code == 200
    assert "trained_at" in retrain.json()
