# MedShelf Demo Video Script

Target length: 2 minutes 45 seconds. The Devpost limit is 3 minutes or under,
and the video needs voiceover.

## Pre-Recording Setup

From a fresh clone or clean local checkout:

```bash
cp .env.example .env
npm run setup
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

For a clean recording state, keep the dev server running and run this in a
second terminal:

```bash
npm run seed:reset
```

Refresh the browser. Use the seeded demo data. Keep the recording window at a
comfortable desktop width, and zoom the browser to 90-100% if the whole app does
not fit cleanly.

Optional backup fixture for the OCR segment:

```text
docs/fixtures/sample-leaflet-image.png
```

## Recording Checklist

- YouTube visibility must be public or unlisted and viewable in an incognito
  window.
- Speak in English, or include an English translation in the submission.
- Mention what the project does, how Codex was used, and how GPT-5.6 was used.
- Do not present OCR or AI output as medical advice.
- Keep this under 3 minutes.

## Script

### 0:00-0:20 Opening

Show the dashboard.

Say:

"MedShelf is a safety-first medicine tracker for people who need help managing
what to take, when to take it, how much supply remains, and how to preserve
confusing medicine leaflet information."

Say:

"The safety principle is simple: user-entered plans, prescriptions, labels, and
pharmacist guidance stay as the source of truth. OCR and AI output are
review-only helpers."

### 0:20-0:40 Codex And GPT-5.6

Stay on the dashboard while slowly moving through the visible panels.

Say:

"I built MedShelf iteratively in Codex: first the FastAPI, React, and SQLite
scaffold, then medicine tracking, schedules, dose logging, inventory estimates,
leaflet uploads, OCR fallback, and the review workflow. I used GPT-5.6 in Codex
for the final submission-readiness and demo-compliance pass, comparing the
official Devpost requirements against the project and tightening this demo."

Say:

"The public demo runs without paid API calls. The app also includes an optional
OpenAI Responses extraction provider configured with
OPENAI_EXTRACTION_MODEL=gpt-5.6 for teams who want to test AI extraction behind
their own key."

### 0:40-1:10 Schedules And Inventory

Show:

- Today's doses.
- Low-stock panel.
- Medicine list.

Click `Evening Allergy Tablet`.

Say:

"Here is the everyday tracker. MedShelf combines schedules with the user-entered
dose amount to estimate supply, shows low-stock medicines, and links to Google
search for restocking."

If today's dose is visible, click `Taken`.

Say:

"When I mark a dose as taken, the inventory count updates immediately. The app
tracks logistics without changing the user's care plan."

### 1:10-1:25 Non-Routine Storage Tracking

Open or edit a medicine marked `Non-routine medicine`, or briefly click `Edit`
on a medicine and point to the checkbox near dose amount.

Say:

"Not every medicine has a daily schedule. For non-routine medicines, MedShelf can
track storage and low stock without forcing a repeating dose schedule."

Cancel the edit if you opened the form.

### 1:25-1:55 Leaflet Image Viewer

Select a medicine with uploaded leaflet images, then click `View image`.

Show:

- Multi-page thumbnails.
- Zoom in.
- Pan around the leaflet.
- Rotate once.
- Adjust brightness or contrast.

Say:

"Real medicine leaflets are often tiny, folded, or photographed under bad
lighting. When OCR is not reliable, MedShelf preserves the original leaflet and
gives the user a full-screen reader with page thumbnails, zoom, pan, rotate,
brightness, and contrast."

Close the viewer.

### 1:55-2:25 Review Workflow

Open `Pending Leaflet Sample`, then click `Review`.

Show:

- Needs-review status.
- Confidence labels.
- Source snippets.
- Editable fields.
- Remove-field action.

Say:

"Any OCR or AI-derived guidance stays in needs-review status. The user can edit
or remove uncertain fields, and source snippets stay next to claims so they can
compare the draft against the leaflet."

Approve the guidance.

Say:

"Only after approval does the guidance become saved reviewed content on the
medicine profile."

### 2:25-2:45 Closing

Return to the dashboard.

Say:

"MedShelf focuses on a safer workflow: track routines and supply manually,
support non-routine storage tracking, preserve leaflet images for readability,
and keep OCR or AI output review-only until approved. That makes it useful for
caregivers and older users without pretending to be medical advice."

## Optional OCR Segment

Use this only if your recording is still safely under 3 minutes.

Upload `docs/fixtures/sample-leaflet-image.png`, run `Read image text`, show OCR
progress, edit the OCR text, and click `Upload and create review draft`.

Say:

"Browser OCR is optional and local-first. If OCR is poor, the user can keep the
image, paste text manually, or enter their medicine plan themselves."

## Submission Reminders

- Add the YouTube link to Devpost only after confirming it opens in an
  incognito/private window.
- Add the GitHub repository URL. If the repo is private, share it with
  `testing@devpost.com` and `build-week-event@openai.com` before the deadline.
- Include the Codex `/feedback` Session ID from the primary build thread.
- Submit the project description, track, repo, video, and session ID before the
  deadline.
