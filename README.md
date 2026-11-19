# CivicPulse — AI-Assisted Community Problem Detection & Reporting System

Prototype built for **Rajya Stariya Bal Vaigyanik Pradarshani (RSBVP) 2026–27** (Sub-theme: *Artificial Intelligence (AI) for Better Life*, PM SHRI Kendriya Vidyalaya, Ashok Nagar, Chennai).

## Structure
- `Backend/` — FastAPI + SQLite + OpenCV + scikit-learn (`RandomForestClassifier` & TF-IDF NLP similarity)
- `Web/` — Next.js (App Router, TypeScript, Tailwind CSS) + Leaflet (OpenStreetMap)

## Quick Start

### 1. Backend (Port 8000)
```bash
cd Backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Run backend tests:
```bash
cd Backend
python -m pytest -v
```

### 2. Web App (Port 3000)
```bash
cd Web
npm install
npm run dev
```
