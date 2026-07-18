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

## Environment Variables

Copy `.env.example` into your backend environment and fill in:

```bash
OPENAI_API_KEY=your_api_key_here
APP_ENV=development
DATABASE_URL=sqlite:///./medshelf.db
```

## Suggested Demo Flow

1. Open the dashboard and show today's medication plan.
2. Add a medicine manually.
3. Mark a dose as taken and show inventory decreasing.
4. Upload a medicine leaflet image.
5. Show AI extraction, translation, source snippets, confidence, and review.
6. Save reviewed guidance to the medicine profile.
7. Trigger a low-stock alert and show restock search links.

