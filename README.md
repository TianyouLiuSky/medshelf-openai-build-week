# MedShelf

MedShelf is a proposed OpenAI Build Week project: a safety-first medicine tracker that helps people manage medicine schedules, remaining supply, and confusing medication leaflets.

The app is designed as a web UI / progressive web app. Users can add medicines manually, track doses, monitor low stock, and upload medicine leaflet photos or PDFs. The AI feature extracts, translates, and simplifies leaflet instructions into a reviewed care guide while preserving source snippets and uncertainty.

## Competition Fit

- Event: OpenAI Build Week on Devpost
- Suggested track: Apps for Your Life
- Core OpenAI usage: GPT-5.6 via the Responses API for vision, extraction, translation, summarization, and structured JSON output
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
- AI: OpenAI Responses API with GPT-5.6
- Deployment: Vercel/Netlify for frontend and Render/Railway/Fly.io for backend, or a single Docker deployment

## Documentation

- [Product Brief](./docs/product-brief.md)
- [Product Requirements](./docs/product-requirements.md)
- [Technical Architecture](./docs/technical-architecture.md)
- [Implementation Backlog](./docs/implementation-backlog.md)
- [AI Extraction Contract](./docs/ai-extraction-contract.md)
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
- `GET /api/dashboard/today?date=YYYY-MM-DD`
- `POST /api/demo/seed`

### Checks

```bash
npm --prefix frontend run build
python3 -m pytest backend
```

## Environment Variables

Copy `.env.example` into your local environment and fill in:

```bash
OPENAI_API_KEY=your_api_key_here
APP_ENV=development
DATABASE_URL=sqlite:///./medshelf.db
BACKEND_CORS_ORIGINS=http://localhost:5173
SEED_DEMO_DATA=true
VITE_API_BASE_URL=http://127.0.0.1:8000
```

## Suggested Demo Flow

1. Open the dashboard and show today's medication plan.
2. Add a medicine manually.
3. Mark a dose as taken and show inventory decreasing.
4. Upload a medicine leaflet image.
5. Show AI extraction, translation, source snippets, confidence, and review.
6. Save reviewed guidance to the medicine profile.
7. Trigger a low-stock alert and show restock search links.
