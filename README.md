# MedShelf

MedShelf is a proposed OpenAI Build Week project: a safety-first medicine tracker that helps people manage medicine schedules, remaining supply, and confusing medication leaflets.

The app is designed as a web UI / progressive web app. Users can add medicines manually, track doses, monitor low stock, and upload medicine leaflet photos or PDFs. The AI feature extracts, translates, and simplifies leaflet instructions into a reviewed care guide while preserving source snippets and uncertainty.

## Competition Fit

- Event: OpenAI Build Week on Devpost
- Suggested track: Apps for Your Life
- Core OpenAI usage: optional Responses API provider for leaflet extraction, translation, summarization, and structured JSON output
- Project goal: Turn difficult medicine instructions into a practical, reviewed medicine plan

## MVP Features

- Add and edit medicines
- Create dose schedules
- Mark scheduled doses as taken, skipped, or missed
- Track remaining quantity and low-stock warnings
- Upload medicine leaflet images or PDFs
- Extract key guidance from leaflet content
- Translate and simplify instructions
- Require user review before saving AI-derived medical guidance
- Suggest restock search links when inventory is low

## Safety Positioning

MedShelf is informational support, not medical advice. It should never invent dosage instructions, override prescriptions, or silently convert uncertain leaflet content into care instructions. Any unclear extraction should be marked as needing review.

## Recommended Stack

- Frontend: React, Vite, TypeScript
- Styling: Tailwind CSS or plain CSS modules
- Backend: FastAPI
- Database: SQLite for the hackathon MVP
- Python ORM: SQLModel or SQLAlchemy
- AI: Provider-based leaflet extraction with mock default, optional local OCR, and optional OpenAI Responses API
- Deployment: Vercel/Netlify for frontend and Render/Railway/Fly.io for backend, or a single Docker deployment

## Documentation

- [Product Brief](./docs/product-brief.md)
- [Product Requirements](./docs/product-requirements.md)
- [Technical Architecture](./docs/technical-architecture.md)
- [Implementation Backlog](./docs/implementation-backlog.md)
- [AI Extraction Contract](./docs/ai-extraction-contract.md)
- [Demo Script](./docs/demo-script.md)
- [Submission Checklist](./docs/submission-checklist.md)

## Local Development Target

The initial implementation should aim for:

1. A working medicine tracker without AI.
2. A working leaflet upload and AI extraction flow.
3. A polished demo with sample medicines and sample leaflet data.

## Local Development

MedShelf is split into a Vite React frontend and a FastAPI backend.

### Prerequisites

- Node.js 20 or newer
- npm
- Python 3.11 or newer

### Environment Setup

Copy the shared example environment file before running the app:

```bash
cp .env.example .env
```

The default `.env.example` uses mock leaflet extraction, so the main demo does
not require OpenAI credits or a local OCR install.

### Quick Start

Terminal 1:

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
```

Terminal 2:

```bash
npm --prefix frontend install
npm --prefix frontend run dev
```

Open [http://localhost:5173](http://localhost:5173), then click `Load demo data`
if the seeded medicines are not already visible. The button adds missing sample
records without deleting medicines you entered manually.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs at [http://localhost:5173](http://localhost:5173). With `VITE_API_BASE_URL` set, the frontend calls the backend directly; otherwise Vite proxies `/api` requests to the backend.

### Backend

```bash
python3 -m venv .venv
source .venv/bin/activate
python -m pip install -r backend/requirements.txt
uvicorn backend.app.main:app --reload
```

The API runs at [http://127.0.0.1:8000](http://127.0.0.1:8000). The health check is available at `GET /api/health`.

On first startup, the backend creates the SQLite database and loads demo medicines when `SEED_DEMO_DATA=true`.
Leaflet uploads are stored under `./uploads/leaflets` by default. That folder is ignored by git.
Leaflet extraction uses `EXTRACTION_PROVIDER=mock` by default, so the local demo does not require OpenAI or any paid API. Optional providers are `local_ocr` and `openai`.
The seeded demo includes daily schedule data, low-stock inventory, one approved
leaflet guidance record, and one pending leaflet extraction ready for review.

### API Routes

- `GET /api/health`
- `GET /api/medications`
- `POST /api/medications`
- `GET /api/medications/{id}`
- `PATCH /api/medications/{id}`
- `DELETE /api/medications/{id}`
- `GET /api/medications/{id}/schedules`
- `POST /api/medications/{id}/schedules`
- `PATCH /api/schedules/{id}`
- `DELETE /api/schedules/{id}`
- `POST /api/medications/{id}/doses`
- `GET /api/medications/{id}/leaflets`
- `POST /api/medications/{id}/leaflet`
- `GET /api/medications/{id}/leaflet-guidance`
- `GET /api/leaflets/{id}/extraction`
- `POST /api/leaflets/{id}/extract`
- `POST /api/leaflets/{id}/approve`
- `GET /api/dashboard/today?date=YYYY-MM-DD`
- `GET /api/restock/suggestions?medication_id={id}&region=optional`
- `POST /api/demo/seed`

### Leaflet Extraction Providers

- `mock`: default provider for local demos. Reads text uploads, creates conservative draft extraction records, and keeps them in `needs_review`.
- `local_ocr`: reads text uploads directly and can run a configured OCR command such as `tesseract` for image uploads. Install the OCR tool separately if you want image OCR locally.
- `openai`: optional provider behind `OPENAI_API_KEY`, `OPENAI_API_BASE_URL`, and `OPENAI_EXTRACTION_MODEL`. It uses structured JSON output and stores both the raw model response and validated parsed output.

AI-derived extraction output remains draft data with `needs_review=true` until
the user edits/reviews it and clicks Approve.

### Privacy And Safety Notes

- The default local demo uses `EXTRACTION_PROVIDER=mock`, so uploaded demo files
  do not leave your machine for AI processing.
- Uploaded leaflet files are stored in the git-ignored `./uploads/leaflets`
  folder by default.
- AI-derived output stays in `needs_review` until the user explicitly approves
  it into reviewed guidance.
- The app is informational support only. Clinician, pharmacist, prescription,
  and package-label directions remain the source of truth.

### Checks

```bash
npm --prefix frontend run build
python3 -m pytest backend
```

## Environment Variables

Copy `.env.example` into your local environment and fill in:

```bash
OPENAI_API_KEY=
APP_ENV=development
DATABASE_URL=sqlite:///./medshelf.db
BACKEND_CORS_ORIGINS=http://localhost:5173
SEED_DEMO_DATA=true
LEAFLET_UPLOAD_DIR=./uploads/leaflets
LEAFLET_MAX_UPLOAD_BYTES=10000000
EXTRACTION_PROVIDER=mock
LOCAL_OCR_COMMAND=tesseract
LOCAL_OCR_TIMEOUT_SECONDS=20
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_EXTRACTION_MODEL=gpt-4o-mini
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Suggested Demo Flow

1. Open the dashboard and show today's medication plan.
2. Select `Evening Allergy Tablet` and show low-stock restock links.
3. Mark a scheduled dose as taken and show inventory decreasing.
4. Select `Pending Leaflet Sample`, open `Review`, edit or remove one extracted field, and approve guidance.
5. Show the approved guidance on the medicine profile.
6. Upload the sample leaflet fixture at `docs/fixtures/sample-leaflet.txt` to demo the upload/extract path from scratch.

For a short narration outline, see [docs/demo-script.md](./docs/demo-script.md).
