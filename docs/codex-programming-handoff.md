# Codex Programming Handoff

## Build Objective

Implement MedShelf as a working hackathon web app. The app should let users manage medicines, track schedules and inventory, upload leaflet images, and review AI-extracted guidance.

## First Build Target

Build the smallest complete vertical slice:

1. FastAPI backend with SQLite.
2. React frontend.
3. Medicine CRUD.
4. Dashboard showing today's medicines.
5. Dose taken action that decreases inventory.
6. Low-stock alert.

After that works, add the leaflet AI flow.

## Preferred Repository Layout

```text
backend/
  app/
    main.py
    models.py
    database.py
    schemas.py
    routes/
    services/
  tests/
  pyproject.toml

frontend/
  src/
    components/
    pages/
    api/
    types/
  package.json

docs/
README.md
AGENTS.md
```

## Backend Notes

- Use Pydantic models for API request/response contracts.
- Keep OpenAI calls behind a service module such as `app/services/openai_extraction.py`.
- Make AI extraction testable by allowing a mocked model response.
- Keep uploaded files out of git.

## Frontend Notes

- Start with a practical app shell.
- Use responsive layout from the beginning.
- Build clear states for loading, error, empty, due, taken, missed, and low stock.
- Make the AI review screen editable.

## OpenAI Integration Notes

- Use structured output for leaflet extraction.
- Ask for source snippets and confidence for important claims.
- Store raw extraction output for debugging.
- Treat AI output as draft until user-approved.

## Demo Data

Create sample data for:

- One daily medication with enough stock.
- One low-stock medication.
- One medicine with reviewed leaflet guidance.
- One pending AI extraction that needs review.

## Done Definition

The project is demo-ready when a fresh clone can run the app, seed demo data, upload a sample leaflet, review extracted guidance, and show a low-stock restock suggestion.

