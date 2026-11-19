"""NLP module for CivicPulse: TF-IDF similarity, geo-proximity, and urgency cues."""

from __future__ import annotations

import math
import re
from typing import Any

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

HIGH_SEVERITY_TERMS = {
    "sparking", "live", "wire", "shock", "flood", "flooded", "burst",
    "sewage", "broken", "collapsed", "hazard", "dangerous", "accident",
    "overflowing", "blocked", "dark", "unlit",
}

HIGH_IMPACT_TERMS = {
    "school", "hospital", "bus", "stop", "market", "junction", "main",
    "pedestrian", "children", "elderly", "footpath", "walkway", "gate",
}


def haversine_meters(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Compute approximate distance in meters between two coordinates."""
    r_earth = 6_371_000.0
    phi1, phi2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lng2 - lng1)
    a = (
        math.sin(dphi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(dlambda / 2.0) ** 2
    )
    return 2.0 * r_earth * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))


def estimate_initial_priority_factors(description: str, location_label: str) -> tuple[float, float]:
    """Suggest conservative initial Severity (S) and Impact (I) from NLP cues."""
    tokens = set(re.findall(r"[a-z0-9]+", f"{description} {location_label}".lower()))
    sev_hits = len(tokens & HIGH_SEVERITY_TERMS)
    imp_hits = len(tokens & HIGH_IMPACT_TERMS)

    s_est = min(85.0, 45.0 + 12.0 * sev_hits)
    i_est = min(85.0, 45.0 + 12.0 * imp_hits)
    return s_est, i_est


def find_similar_reports_nlp(
    description: str,
    location_label: str,
    existing_reports: list[dict[str, Any]],
    approx_lat: float | None = None,
    approx_lng: float | None = None,
    top_k: int = 3,
    threshold: float = 0.18,
) -> list[dict[str, Any]]:
    """Use scikit-learn TF-IDF cosine similarity + geo-proximity for duplicate suggestions.

    Never auto-merges; returns candidate matches for human verification.
    """
    query_text = f"{description or ''} {location_label or ''}".strip()
    if not query_text or not existing_reports:
        return []

    corpus = [
        f"{r.get('description', '')} {r.get('location_label', '')}".strip()
        for r in existing_reports
    ]
    vectorizer = TfidfVectorizer(
        stop_words="english",
        ngram_range=(1, 2),
        lowercase=True,
    )
    try:
        tfidf_matrix = vectorizer.fit_transform([query_text] + corpus)
    except ValueError:
        return []

    sims = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:]).flatten()
    matches: list[dict[str, Any]] = []

    for idx, report in enumerate(existing_reports):
        text_sim = float(sims[idx])
        dist_m: float | None = None
        geo_boost = 0.0
        if approx_lat is not None and approx_lng is not None:
            dist_m = haversine_meters(
                approx_lat,
                approx_lng,
                float(report["approx_lat"]),
                float(report["approx_lng"]),
            )
            if dist_m <= 250:
                geo_boost = 0.15
            elif dist_m <= 600:
                geo_boost = 0.07

        combined = min(0.99, text_sim * 0.85 + geo_boost)
        if text_sim >= 0.10 and combined >= threshold:
            matches.append(
                {
                    "report_id": report["id"],
                    "description": report["description"],
                    "category": report["category"],
                    "location_label": report["location_label"],
                    "status": report["status"],
                    "is_sample": bool(report.get("is_sample", False)),
                    "similarity_score": round(combined, 2),
                    "text_similarity": round(text_sim, 2),
                    "distance_meters": round(dist_m) if dist_m is not None else None,
                }
            )

    matches.sort(key=lambda m: m["similarity_score"], reverse=True)
    return matches[:top_k]
