"""Domain constants for CivicPulse (RSBVP 2026-27 prototype)."""

CATEGORIES = [
    "Overflowing garbage bin",
    "Water leakage",
    "Damaged footpath / road",
    "Streetlight problem",
    "Other / Not sure",
]

STATUSES = [
    "Submitted",
    "Under Review",
    "Verified",
    "In Progress",
    "Resolved",
]

PRIORITY_WEIGHTS = {
    "S": 0.35,  # Estimated severity (0-100)
    "I": 0.30,  # Public impact (0-100)
    "R": 0.20,  # Recurrence (0-100)
    "T": 0.15,  # Time unresolved (0-100)
}

PRIORITY_BANDS = [
    {"label": "LOW", "min": 0, "max": 29},
    {"label": "MEDIUM", "min": 30, "max": 59},
    {"label": "HIGH", "min": 60, "max": 79},
    {"label": "CRITICAL", "min": 80, "max": 100},
]

CONFIDENCE_REVIEW_THRESHOLD = 0.60

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024  # 8 MB

# Default approximate center: Ashok Nagar, Chennai (public area)
DEFAULT_CENTER_LAT = 13.0373
DEFAULT_CENTER_LNG = 80.2123
