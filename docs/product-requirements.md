# Product Requirements

## Personas

### Individual User

Needs a simple way to know what to take today, how much remains, and what the leaflet says in plain language.

### Caregiver

Needs a clear view of multiple medicines, missed doses, and low-stock items.

### Traveler

Needs translation and simplification for medicine purchased in a language they do not read fluently.

## Functional Requirements

### Medicine Management

- Create, read, update, and delete medicines.
- Store medicine name, form, strength, quantity, dose amount, low-stock threshold, and notes.
- Allow the user to attach leaflet guidance to a medicine.

### Schedule Management

- Support simple recurring schedules.
- Support one or more daily dose times.
- Support start and optional end dates.
- Show today's due medicines.

### Dose Tracking

- Mark a dose as taken.
- Mark a dose as skipped.
- Automatically classify overdue doses as missed.
- Decrease inventory after a taken dose.

### Inventory

- Show current remaining quantity.
- Warn when inventory is below threshold.
- Estimate days remaining based on schedule.

### Leaflet Upload

- Accept image uploads for MVP.
- Accept PDF uploads as stretch.
- Store the raw uploaded file locally during development.
- Run no-paid browser OCR for images where possible.
- Let the user edit OCR text before sending leaflet content to the extraction
  pipeline.

### AI Review

- Display extracted fields with confidence and source snippets.
- Show warnings and contradictions prominently.
- Require user confirmation before saving.
- Allow user edits before saving.

### Restock

- Show restock suggestions for low-stock medicines.
- Generate search links for the medicine name and user-provided region.
- Stretch: link to local pharmacy/map search.

## Non-Functional Requirements

- Must be easy to run locally.
- Must have a clear demo path.
- Must be responsive on desktop and mobile.
- Must fail gracefully when the OpenAI API is unavailable.
- Must avoid storing secrets in git.

## Acceptance Criteria

- A user can complete the main demo flow without using the terminal.
- AI output can be reviewed and edited before saving.
- The app visibly distinguishes source-grounded guidance from user-entered plans.
- Low-stock behavior is visible in the dashboard.
- README explains setup, architecture, and OpenAI usage.
