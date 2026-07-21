# Submission Checklist

## Required Submission Assets

- Public GitHub repository with relevant licensing, or a private repository
  shared with `testing@devpost.com` and `build-week-event@openai.com`.
- Clear README with setup instructions, sample data, test guidance, and safety
  limitations.
- Working demo/deployment link if available; otherwise make local run commands
  effortless.
- Public or unlisted YouTube demo video that is 3 minutes or under and viewable
  in an incognito/private browser window.
- Voiceover explaining what MedShelf does, how Codex was used, and how GPT-5.6
  was used.
- Explanation that image OCR runs in the browser by default, extraction is
  provider-based with mock default, and OpenAI stays optional behind
  configuration with `OPENAI_EXTRACTION_MODEL=gpt-5.6`.
- Codex `/feedback` Session ID from the primary build thread.

## README Must Include

- What the app does.
- Why it matters.
- How to run locally.
- Sample data and how to reset it.
- OpenAI/Codex/GPT-5.6 features used.
- Architecture summary.
- Safety limitations.
- Demo flow.
- License.

## Demo Video Script

Follow [docs/demo-script.md](./demo-script.md). The required beats are:

1. Introduce MedShelf and the safety principle.
2. Explain Codex and GPT-5.6 usage in the voiceover.
3. Show the seeded dashboard with today's doses, low-stock state, days
   remaining, and restock links.
4. Open `Evening Allergy Tablet`, mark today's dose as taken, and show the
   inventory count decrease.
5. Show non-routine/storage-only tracking.
6. Open a leaflet image with `View image`; show thumbnails, zoom, pan, rotate,
   brightness, and contrast.
7. Open `Pending Leaflet Sample`, click `Review`, and show confidence labels,
   source snippets, editable fields, remove actions, and approval.
8. Close with safety positioning and the no-paid-API public demo path.

## Judging Alignment

### Implementation

Show a real app with working flows, not only mockups. Mention that Codex helped
ship the FastAPI/React/SQLite implementation and that GPT-5.6 was used for the
final requirements/demo review. Point to the optional
`OPENAI_EXTRACTION_MODEL=gpt-5.6` extraction provider without requiring it for
the public demo.

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
- `docs/fixtures/sample-leaflet-image.png` is available for the optional image
  OCR upload demo.
- Video is 3 minutes or under and includes voiceover.
- Video link opens in an incognito/private browser window.
- GitHub repository includes `LICENSE`.
- Devpost submission includes the Codex `/feedback` Session ID.
- If the repository is private, it has been shared with the two official judging
  email addresses before the deadline.
- Upload failures are handled.
- AI uncertainty is visible.
- AI-derived guidance remains review-only until approval.
- Medical disclaimer is visible but not overwhelming.
- README, demo script, and checklist agree on the same demo flow.
