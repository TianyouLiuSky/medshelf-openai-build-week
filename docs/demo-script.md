# MedShelf Demo Script

Target length: 2-3 minutes.

## 1. Dashboard

Start on the main app view with demo data loaded.

Say: "MedShelf is a safety-first medicine tracker for schedules, inventory, and reviewed leaflet guidance."

Show:

- Today's dose dashboard.
- Low-stock panel with restock links.
- Medicine list with days remaining.

## 2. Dose And Inventory

Select `Evening Allergy Tablet`.

Show:

- Quantity remaining and days remaining.
- Low-stock restock links.
- Today's scheduled dose if visible.

Say: "Dose logging updates inventory, and low-stock suggestions are separated from medical guidance."

## 3. Leaflet Upload And Extraction

Select `Pending Leaflet Sample`.

Show:

- Leaflet status `Needs review`.
- Click `Review`.
- Confidence labels and source snippets.

Say: "AI output is draft-only. The app keeps source snippets visible and requires user review before saving guidance."

## 4. Review And Approve

Edit or remove one extracted item, then approve the guidance.

Show:

- Leaflet status becomes `Approved`.
- Reviewed leaflet guidance appears on the medicine profile.

Say: "Approved guidance is stored as reviewed user-controlled content, not as unquestioned AI advice."

## 5. Safety Close

Return to the dashboard.

Say: "MedShelf keeps prescriptions, labels, and clinician or pharmacist directions as the source of truth. The default local demo uses mock extraction, so no paid AI API is required."
