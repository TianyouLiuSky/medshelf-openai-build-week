MEDICATIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS medications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    active_ingredients TEXT NOT NULL DEFAULT '',
    form TEXT NOT NULL DEFAULT '',
    strength TEXT NOT NULL DEFAULT '',
    quantity_remaining REAL NOT NULL DEFAULT 0,
    quantity_unit TEXT NOT NULL DEFAULT 'units',
    dose_amount REAL,
    dose_unit TEXT NOT NULL DEFAULT '',
    low_stock_threshold REAL,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (quantity_remaining >= 0),
    CHECK (dose_amount IS NULL OR dose_amount >= 0),
    CHECK (low_stock_threshold IS NULL OR low_stock_threshold >= 0)
);
"""

SCHEDULES_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id INTEGER NOT NULL,
    times TEXT NOT NULL,
    days_of_week TEXT NOT NULL,
    start_date TEXT NOT NULL,
    end_date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
);
"""

DOSE_LOGS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS dose_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id INTEGER NOT NULL,
    schedule_id INTEGER,
    scheduled_at TEXT NOT NULL,
    taken_at TEXT,
    status TEXT NOT NULL,
    quantity_delta REAL NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (status IN ('taken', 'skipped')),
    UNIQUE (schedule_id, scheduled_at),
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE SET NULL
);
"""

LEAFLET_UPLOADS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS leaflet_uploads (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id INTEGER NOT NULL,
    original_filename TEXT NOT NULL,
    stored_filename TEXT NOT NULL,
    source_file_path TEXT NOT NULL,
    content_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'uploaded',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (size_bytes >= 0),
    CHECK (
        status IN (
            'uploaded',
            'queued',
            'extracting',
            'needs_review',
            'failed',
            'approved'
        )
    ),
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
);
"""

LEAFLET_EXTRACTIONS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS leaflet_extractions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    leaflet_upload_id INTEGER NOT NULL,
    medication_id INTEGER NOT NULL,
    provider TEXT NOT NULL,
    status TEXT NOT NULL,
    source_text TEXT NOT NULL DEFAULT '',
    raw_model_output TEXT NOT NULL DEFAULT '',
    parsed_output TEXT,
    error_message TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (status IN ('extracting', 'needs_review', 'failed', 'approved')),
    FOREIGN KEY (leaflet_upload_id) REFERENCES leaflet_uploads(id) ON DELETE CASCADE,
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
);
"""

MEDICATION_COLUMNS = (
    "id",
    "name",
    "active_ingredients",
    "form",
    "strength",
    "quantity_remaining",
    "quantity_unit",
    "dose_amount",
    "dose_unit",
    "low_stock_threshold",
    "notes",
    "created_at",
    "updated_at",
)

LEAFLET_EXTRACTION_COLUMNS = (
    "id",
    "leaflet_upload_id",
    "medication_id",
    "provider",
    "status",
    "source_text",
    "raw_model_output",
    "parsed_output",
    "error_message",
    "created_at",
    "updated_at",
)

LEAFLET_UPLOAD_COLUMNS = (
    "id",
    "medication_id",
    "original_filename",
    "stored_filename",
    "source_file_path",
    "content_type",
    "size_bytes",
    "status",
    "created_at",
    "updated_at",
)

SCHEDULE_COLUMNS = (
    "id",
    "medication_id",
    "times",
    "days_of_week",
    "start_date",
    "end_date",
    "created_at",
    "updated_at",
)

DOSE_LOG_COLUMNS = (
    "id",
    "medication_id",
    "schedule_id",
    "scheduled_at",
    "taken_at",
    "status",
    "quantity_delta",
    "created_at",
    "updated_at",
)
