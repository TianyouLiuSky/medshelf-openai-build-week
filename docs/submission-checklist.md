# Submission Checklist

## Required Submission Assets

- Public or shareable GitHub repository.
- Clear README.
- Working demo or deployment link.
- YouTube demo video under 3 minutes.
- Explanation of how Codex was used to build and iterate on the MVP.
- Explanation that leaflet extraction is provider-based: mock by default for the
  local demo, with optional OpenAI extraction behind configuration.
- Feedback submitted through `/feedback` with Codex Session ID.

## README Must Include

- What the app does.
- Why it matters.
- How to run locally.
- OpenAI features used.
- Architecture summary.
- Safety limitations.
- Demo flow.

## Demo Video Script

1. Introduce MedShelf in one sentence.
2. Show the seeded dashboard with today's doses, low-stock state, days
   remaining, and restock links.
3. Open `Evening Allergy Tablet`, mark today's dose as taken, and show the
   inventory count decrease.
4. Open `Pending Leaflet Sample`, click `Review`, and show confidence labels,
   source snippets, editable fields, and remove actions.
5. Edit or remove one extracted item, approve the guidance, and show the
   reviewed guidance on the medicine profile.
6. Optionally upload `docs/fixtures/sample-leaflet.txt` if there is time to show
   the extraction path from scratch.
7. Close with safety positioning, the mock-default local demo, and the optional
   OpenAI provider path.

## Judging Alignment

### Implementation

Show a real app with working flows, not only mockups.

### Design

Use a clean, calm, mobile-friendly interface.

### Impact

Emphasize accessibility, translation, caregiver use, and avoiding medicine confusion.

### Idea Quality

Frame the project as a bridge between medicine documentation, personal routines, and inventory management.

## Final Polish Checks

- No secrets committed.
- App works from a fresh clone.
- Demo data is available.
- Local run commands in the README are verified: `npm run setup`, `npm run dev`,
  `npm run check`, and production-style `npm start`.
- `docs/fixtures/sample-leaflet.txt` is available for the optional upload demo.
- Upload failures are handled.
- AI uncertainty is visible.
- AI-derived guidance remains review-only until approval.
- Medical disclaimer is visible but not overwhelming.
- README, demo script, and checklist agree on the same demo flow.
