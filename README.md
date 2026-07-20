# MedShelf

MedShelf is an OpenAI Build Week project: a safety-first medicine tracker that helps people manage medicine schedules, remaining supply, and confusing medication leaflets.

The app is designed as a web UI / progressive web app. Users can add medicines manually, track doses, monitor low stock, and upload medicine leaflet files. The default local demo uses text leaflet fixtures; image OCR and PDF extraction are available only through optional providers. The AI feature extracts, translates, and simplifies leaflet instructions into a reviewed care guide while preserving source snippets and uncertainty.

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
- Upload medicine leaflet files
- Extract key guidance from text leaflet fixtures in the default demo
- Translate and simplify instructions when using a configured extraction provider
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

MedShelf is split into a Vite React frontend and a FastAPI backend. The easiest
local path is through the root npm scripts, which set up both sides and run them
together.

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
The FastAPI backend automatically reads `.env` from the repository root. The
frontend works through the Vite `/api` proxy by default; set frontend-specific
Vite variables in your shell or in `frontend/.env.local` only if you need them.

### Quick Start

From the repository root:

```bash
npm run setup
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). The first command creates
`.env`, installs Python dependencies into `.venv`, and installs frontend
dependencies. The second command starts both the FastAPI backend and Vite
frontend together.

For later local runs, use:

```bash
npm run dev
```

If the seeded medicines are not already visible, click `Load demo data`. The
button adds missing sample records without deleting medicines you entered
manually.

### Recording Setup

For a clean recording state after both servers are running, reset the seeded demo
data:

```bash
npm run seed:reset
```

Refresh [http://localhost:5173](http://localhost:5173) after the reset. This
resets the local SQLite demo database, so use it only when you want a clean
recording state.

### Production-Style Run

For a single-service run that serves the built React app from FastAPI:

```bash
npm run setup
npm run build
npm start
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000). Cloud platforms can set
`PORT`, `DATABASE_URL`, `LEAFLET_UPLOAD_DIR`, and the optional extraction
provider variables before running `npm start`.

For a simple hosted deployment, use:

- Build command: `npm run setup && npm run build`
- Start command: `npm start`
- Health check path: `/api/health`

### Frontend

For frontend-only troubleshooting:

```bash
cd frontend
npm install
npm run dev
```

The Vite dev server runs at [http://localhost:5173](http://localhost:5173). By default, Vite proxies `/api` requests to the backend. If you need a custom API base URL, set `VITE_API_BASE_URL` in your shell or in `frontend/.env.local`.

### Backend

For backend-only troubleshooting:

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

- `mock`: default provider for local demos. Reads `.txt` uploads, creates conservative draft extraction records, and keeps them in `needs_review`. It stores image/PDF uploads but does not read their contents.
- `local_ocr`: reads text uploads directly and can run a configured OCR command such as `tesseract` for image uploads. Install the OCR tool separately if you want image OCR locally. PDF extraction is not supported by this provider.
- `openai`: optional provider behind `OPENAI_API_KEY`, `OPENAI_API_BASE_URL`, and `OPENAI_EXTRACTION_MODEL`. It can process text, image, and PDF uploads through the Responses API and stores both the raw model response and validated parsed output.

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
npm run check
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
FRONTEND_DIST_DIR=./frontend/dist
```

## Final Recording Flow

Aim for 2-3 minutes:

1. Open the dashboard with seeded data and introduce MedShelf as schedule,
   inventory, and reviewed leaflet guidance in one place.
2. Show today's doses, the low-stock panel, days remaining, and pharmacy/Google
   restock links.
3. Open `Evening Allergy Tablet`, mark today's dose as taken, and point out the
   inventory decrease.
4. Open `Pending Leaflet Sample`, click `Review`, and show confidence labels,
   source snippets, editable fields, and remove actions.
5. Edit or remove one extracted field, approve the guidance, and show that it is
   saved as reviewed guidance rather than automatic medical advice.
6. Upload `docs/fixtures/sample-leaflet.txt` only if time allows, to show the
   demo extraction path from scratch.

For a concise narration outline, see [docs/demo-script.md](./docs/demo-script.md).
