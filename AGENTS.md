# Codex Instructions

This repository is for the OpenAI Build Week MedShelf project.

## Product Goal

Build a web app / PWA that helps users track medicines, dose schedules, remaining supply, and AI-simplified medicine leaflet guidance. The most important differentiator is a safe leaflet-reading workflow that extracts, translates, and simplifies medicine instructions while keeping the user in control.

## Engineering Direction

- Prefer a React + Vite + TypeScript frontend.
- Prefer a Python FastAPI backend.
- Prefer SQLite for the hackathon MVP.
- Keep the system easy to run locally.
- Avoid adding heavy infrastructure unless it directly helps the demo.
- Keep API contracts explicit and documented.
- Store AI outputs as reviewed records, not unquestioned facts.

## UX Direction

- Build the real app as the first screen, not a marketing landing page.
- Prioritize dashboard, medicine detail, upload/review, and restock states.
- The interface should feel calm, legible, and health-oriented without looking clinical or sterile.
- Use clear status states: due, taken, skipped, missed, low stock, needs review.
- Do not bury warnings. Show important safety guidance near the relevant medicine.

## Medical Safety Rules

- Never present AI output as medical advice.
- Never invent dosage, frequency, contraindications, or side effects.
- Preserve source snippets for important extracted claims.
- Mark uncertain text as `needs_review`.
- Require explicit user review before saving AI-derived guidance.
- Remind users to follow clinician/pharmacist directions when leaflet text and user-entered plan conflict.

## Suggested Implementation Order

1. Scaffold frontend and backend.
2. Add medicine CRUD.
3. Add schedule and dose logging.
4. Add inventory countdown and low-stock alerts.
5. Add leaflet upload endpoint.
6. Add AI structured extraction.
7. Add review UI.
8. Add restock search links.
9. Polish demo data, README, and submission assets.

## Verification

Before considering a feature complete:

- Run frontend type checks and build.
- Run backend tests if present.
- Manually test the main demo flow.
- Check mobile and desktop layouts.
- Confirm AI extraction failures show a recoverable error state.

