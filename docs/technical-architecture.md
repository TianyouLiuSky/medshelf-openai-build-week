# Technical Architecture

## Overview

MedShelf should use a small frontend/backend architecture that is easy to build during the hackathon and easy for judges to run.

```mermaid
flowchart TD
    UI["React PWA"] --> API["FastAPI backend"]
    API --> DB["SQLite database"]
    API --> FILES["Local upload storage"]
    API --> OPENAI["OpenAI Responses API"]
    OPENAI --> API
    API --> UI
```

## Frontend

Recommended:

- React
- Vite
- TypeScript
- Tailwind CSS or CSS modules
- React Router

Core screens:

- Dashboard
- Medicine list
- Medicine detail
- Add/edit medicine
- Leaflet upload
- AI review
- Settings/demo data

## Backend

Recommended:

- FastAPI
- Pydantic models
- SQLModel or SQLAlchemy
- SQLite
- Uvicorn

Core API routes:

- `GET /api/medications`
- `POST /api/medications`
- `GET /api/medications/{id}`
- `PATCH /api/medications/{id}`
- `DELETE /api/medications/{id}`
- `POST /api/medications/{id}/doses`
- `POST /api/medications/{id}/leaflet`
- `POST /api/leaflets/{id}/extract`
- `POST /api/leaflets/{id}/approve`
- `GET /api/restock/suggestions?medication_id=...`

## AI Flow

1. User uploads a leaflet image.
2. Backend stores the file.
3. Backend sends image and extraction instructions to OpenAI.
4. OpenAI returns structured JSON.
5. Backend validates JSON with Pydantic.
6. Frontend shows review UI.
7. User edits/approves.
8. Backend saves reviewed guidance.

## Database Tables

### medications

- `id`
- `name`
- `active_ingredients`
- `form`
- `strength`
- `quantity_remaining`
- `quantity_unit`
- `dose_amount`
- `dose_unit`
- `low_stock_threshold`
- `notes`
- `created_at`
- `updated_at`

### schedules

- `id`
- `medication_id`
- `times`
- `days_of_week`
- `start_date`
- `end_date`

### dose_logs

- `id`
- `medication_id`
- `scheduled_at`
- `taken_at`
- `status`
- `quantity_delta`

### leaflet_extractions

- `id`
- `medication_id`
- `source_file_path`
- `raw_model_output`
- `reviewed_guidance`
- `status`
- `created_at`

## Error Handling

- If AI extraction fails, show a retry button and preserve upload.
- If extraction is uncertain, keep `needs_review` true.
- If inventory would become negative, warn but allow user correction.
- If the app is offline, keep the tracker usable and disable AI upload.

## Deployment Notes

For the hackathon, prefer a simple public deployment. If split hosting becomes too slow, use one backend that serves built frontend static files.

