# MedShelf

MedShelf is an OpenAI Build Week project: a safety-first medicine tracker that helps people manage medicine schedules, remaining supply, and confusing medication leaflets.

The app is designed as a web UI / progressive web app. Users can add medicines manually, track doses, monitor low stock, and upload medicine leaflet files. The default public demo reads leaflet images with browser-side OCR, lets users edit the OCR text, then turns that text into a reviewed care guide while preserving source snippets and uncertainty. OpenAI remains optional behind configuration.

## OpenAI Build Week Fit

- Event: OpenAI Build Week on Devpost
- Track: Apps for Your Life
- Core OpenAI usage: Codex was used end-to-end to plan, implement, debug, and
  polish the MVP. GPT-5.6 was used in Codex for the final submission-readiness
  and demo-compliance pass, including comparing the official Devpost
  requirements against the project and tightening the demo script.
- Optional app integration: the OpenAI Responses provider can run leaflet
  extraction, translation, summarization, and structured JSON output with
  `OPENAI_EXTRACTION_MODEL=gpt-5.6` when `EXTRACTION_PROVIDER=openai` and an API
  key are configured.
- Public demo path: browser OCR plus the mock extraction provider, so judges can
  test the core product without using paid OCR or OpenAI API calls.
- Project goal: Turn difficult medicine instructions into a practical, reviewed
  medicine plan without letting OCR or AI override user-entered directions.

For Devpost, include the Codex `/feedback` Session ID from the primary build
thread in the submission form and mention the Codex/GPT-5.6 usage above in the
voiceover.

## MVP Features

- Add and edit medicines
- Create dose schedules
- Mark medicines as non-routine for storage-only tracking without a required
  schedule
- Mark scheduled doses as taken, skipped, or missed
- Track remaining quantity and low-stock warnings
- Upload medicine leaflet files, including common image formats
- View multi-page leaflet images full-screen with thumbnails, zoom, pan, rotate,
  brightness, and contrast controls
- Read leaflet images in the browser with no paid OCR or AI API required
- Extract key guidance from edited OCR text and text leaflet fixtures
- Translate and simplify instructions when using a configured extraction provider
- Require user review before saving AI-derived medical guidance
- Suggest restock search links when inventory is low

## Safety Positioning

MedShelf is informational support, not medical advice. It should never invent dosage instructions, override prescriptions, or silently convert uncertain leaflet content into care instructions. Any unclear extraction should be marked as needing review.

## Live Demo

Render URL: _pending Render deployment_.

The public demo is prepared for a single managed Render web service. It runs
without an OpenAI API key or paid OCR API and uses disposable seeded data. See
[Deploy MedShelf On Render](./docs/deployment-render.md) for the exact setup
steps.

## Current Stack

- Frontend: React, Vite, TypeScript
- Styling: plain CSS
- Backend: FastAPI
- Database: SQLite for the hackathon MVP
- AI/OCR: Browser-side OCR by default, provider-based text extraction with mock default, optional local OCR, and optional OpenAI Responses API
- Deployment: single Docker web service on Render, with FastAPI serving the compiled React frontend
- License: MIT

## Documentation

- [Product Brief](./docs/product-brief.md)
- [Product Requirements](./docs/product-requirements.md)
- [Technical Architecture](./docs/technical-architecture.md)
- [Implementation Backlog](./docs/implementation-backlog.md)
- [AI Extraction Contract](./docs/ai-extraction-contract.md)
- [Render Deployment Guide](./docs/deployment-render.md)
- [Demo Script](./docs/demo-script.md)
- [Submission Checklist](./docs/submission-checklist.md)
- [License](./LICENSE)

## Demo Data

The seeded demo includes:

1. A daily medicine with enough stock.
2. A low-stock medicine with schedules and dose logging.
3. A reviewed leaflet guidance sample.
4. A pending extraction sample that is ready for the review UI.
5. A sample leaflet image fixture at `docs/fixtures/sample-leaflet-image.png`.

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

The default `.env.example` uses mock leaflet text extraction, and image OCR runs
in the browser, so the main demo does not require OpenAI credits or a local OCR
install.
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

For the public hosted demo, use the root `Dockerfile` and `render.yaml` with a
Render Blueprint deployment. Render builds the frontend and backend into one
image, then starts FastAPI with the platform-provided `PORT`. See
[docs/deployment-render.md](./docs/deployment-render.md).

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
Leaflet image OCR runs in the browser with Tesseract.js and can convert HEIC/HEIF images before OCR when the browser supports that conversion path. Leaflet text extraction uses `EXTRACTION_PROVIDER=mock` by default, so the local demo does not require OpenAI or any paid API. Optional backend providers are `local_ocr` and `openai`.
The seeded demo includes daily schedule data, low-stock inventory, one approved
leaflet guidance record, and one pending leaflet extraction ready for review.

### API Routes

- `GET /api/health`
- `GET /api/config`
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
- `POST /api/leaflets/{id}/extract/browser-ocr`
- `POST /api/leaflets/{id}/approve`
- `GET /api/dashboard/today?date=YYYY-MM-DD`
- `GET /api/restock/suggestions?medication_id={id}&region=optional`
- `POST /api/demo/seed`

### Leaflet Extraction Providers

- `browser_ocr`: default no-paid image path. The browser reads JPEG/JPG, PNG, WebP, BMP, GIF, and HEIC/HEIF when conversion succeeds, lets the user edit OCR text, then sends that text to the backend for conservative parsing. TIFF uploads are accepted, but browser OCR depends on browser/Tesseract support; use manual text paste if OCR fails.
- `mock`: default provider for local demos. Reads `.txt` uploads, creates conservative draft extraction records, and keeps them in `needs_review`. It stores image/PDF uploads but does not read their contents.
- `local_ocr`: reads text uploads directly and can run a configured OCR command such as `tesseract` for image uploads. Install the OCR tool separately if you want image OCR locally. PDF extraction is not supported by this provider.
- `openai`: optional provider behind `OPENAI_API_KEY`, `OPENAI_API_BASE_URL`,
  and `OPENAI_EXTRACTION_MODEL`. The default optional model is `gpt-5.6` for
  Build Week alignment. It can process text, image, and PDF uploads through the
  Responses API and stores both the raw model response and validated parsed
  output.

OCR and AI-derived extraction output remains draft data with `needs_review=true`
until the user edits/reviews it and clicks Approve.

### Privacy And Safety Notes

- The default local demo uses browser OCR plus `EXTRACTION_PROVIDER=mock`, so
  uploaded demo files do not leave your machine for paid AI processing. The OCR
  library may download language data in the user's browser the first time OCR is
  used.
- Uploaded leaflet files are stored in the git-ignored `./uploads/leaflets`
  folder by default.
- The Render public demo stores SQLite data and uploads under `/tmp/medshelf`.
  That storage is disposable and may reset after restart or redeployment.
- OCR and AI-derived output stays in `needs_review` until the user explicitly
  approves it into reviewed guidance.
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
BACKEND_CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
SEED_DEMO_DATA=true
RESET_DEMO_DATA_ON_START=false
PUBLIC_DEMO=false
LEAFLET_UPLOAD_DIR=./uploads/leaflets
LEAFLET_MAX_UPLOAD_BYTES=10000000
EXTRACTION_PROVIDER=mock
LOCAL_OCR_COMMAND=tesseract
LOCAL_OCR_TIMEOUT_SECONDS=20
OPENAI_API_BASE_URL=https://api.openai.com/v1
OPENAI_EXTRACTION_MODEL=gpt-5.6
FRONTEND_DIST_DIR=./frontend/dist
```

## Final Recording Flow

Aim for 2 minutes 45 seconds or less; Devpost judges are not required to watch
past 3 minutes.

1. State the problem and the safety principle: user-entered plans, labels, and
   pharmacist guidance remain the source of truth.
2. Mention Codex/GPT-5.6 usage: Codex built the FastAPI/React/SQLite app through
   milestone prompts, and GPT-5.6 was used for the final submission-readiness
   and demo-compliance review. The app also has an optional
   `OPENAI_EXTRACTION_MODEL=gpt-5.6` extraction provider.
3. Show the dashboard with seeded data, today's doses, low stock, days
   remaining, and Google restock links.
4. Open `Evening Allergy Tablet`, mark today's dose as taken, and point out the
   inventory decrease.
5. Open a non-routine medicine or edit a medicine to show storage-only tracking
   without a required schedule.
6. Open a leaflet image with `View image`; show thumbnails, zoom, pan, rotate,
   brightness, and contrast.
7. Open `Pending Leaflet Sample`, click `Review`, show confidence/source
   snippets/edit/remove, approve guidance, and show reviewed guidance.

For a direct recording script with setup commands, see
[docs/demo-script.md](./docs/demo-script.md).
