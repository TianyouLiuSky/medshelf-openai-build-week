# MedShelf Demo Script

Target length: 2-3 minutes.

## Pre-Recording Setup

Start MedShelf from the repository root:

```bash
npm run setup
npm run dev
```

If you want a clean seeded demo state, run this after the backend starts:

```bash
npm run seed:reset
```

Then open [http://localhost:5173](http://localhost:5173) and refresh the page.

## 1. Opening Dashboard

Show the dashboard with seeded data loaded.

Say: "MedShelf is a safety-first medicine tracker for schedules, inventory, and reviewed leaflet guidance."

Show:

- Today's dose dashboard.
- Low-stock panel with restock links.
- Medicine list with days remaining.

## 2. Dose And Inventory Check

Select `Evening Allergy Tablet`.

Show:

- Quantity remaining and days remaining.
- Low-stock restock links.
- Today's scheduled dose if visible.
- Mark the dose as taken and show the quantity decrease.

Say: "Dose logging updates inventory, and low-stock suggestions are separated from medical guidance."

## 3. Review AI-Derived Leaflet Draft

Select `Pending Leaflet Sample`.

Show:

- Leaflet status `Needs review`.
- Click `Review`.
- Confidence labels and source snippets.

Say: "AI output is draft-only. The app keeps source snippets visible and requires user review before saving guidance."

## 4. Edit, Remove, And Approve

Edit one extracted item or remove an unnecessary field, then approve the
guidance.

Show:

- Leaflet status becomes `Approved`.
- Reviewed leaflet guidance appears on the medicine profile.

Say: "Approved guidance is stored as reviewed user-controlled content, not as unquestioned AI advice."

## 5. Optional Upload From Scratch

If there is enough time, upload `docs/fixtures/sample-leaflet.txt` from any
medicine's leaflet upload section and run extraction.

Show:

- Upload status.
- Extraction status.
- Draft output staying in review state.

Say: "The default local demo uses mock extraction, so this path works without paid AI credits. OpenAI extraction is available behind configuration."

## 6. Safety Close

Return to the dashboard.

Say: "MedShelf keeps prescriptions, labels, and clinician or pharmacist directions as the source of truth. The default local demo uses mock extraction, so no paid AI API is required."
