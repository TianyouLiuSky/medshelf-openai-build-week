import json
import shutil
from datetime import date, datetime, time, timezone
from pathlib import Path
from sqlite3 import Row
from typing import Any
from urllib.parse import quote_plus

from .database import get_connection
from .models import (
    DOSE_LOG_COLUMNS,
    LEAFLET_EXTRACTION_COLUMNS,
    LEAFLET_GUIDANCE_COLUMNS,
    LEAFLET_UPLOAD_COLUMNS,
    MEDICATION_COLUMNS,
    SCHEDULE_COLUMNS,
)
from .schemas import (
    DoseActionCreate,
    MedicationCreate,
    MedicationUpdate,
    ScheduleCreate,
    ScheduleUpdate,
)


DEMO_MEDICATIONS = [
    MedicationCreate(
        name="Morning Vitamin D",
        active_ingredients="Cholecalciferol",
        form="softgel",
        strength="1000 IU",
        quantity_remaining=42,
        quantity_unit="softgels",
        dose_amount=1,
        dose_unit="softgel",
        low_stock_threshold=10,
        notes="Demo daily supplement with comfortable remaining supply.",
    ),
    MedicationCreate(
        name="Evening Allergy Tablet",
        active_ingredients="Loratadine",
        form="tablet",
        strength="10 mg",
        quantity_remaining=4,
        quantity_unit="tablets",
        dose_amount=1,
        dose_unit="tablet",
        low_stock_threshold=6,
        notes="Demo low-stock medicine. Confirm directions with the package or pharmacist.",
    ),
    MedicationCreate(
        name="Reviewed Leaflet Sample",
        active_ingredients="Example active ingredient",
        form="capsule",
        strength="10 mg",
        quantity_remaining=18,
        quantity_unit="capsules",
        dose_amount=1,
        dose_unit="capsule",
        low_stock_threshold=5,
        notes="Includes approved demo leaflet guidance for screenshots.",
    ),
    MedicationCreate(
        name="Pending Leaflet Sample",
        active_ingredients="Example review ingredient",
        form="solution",
        strength="5 mg / mL",
        quantity_remaining=1,
        quantity_unit="bottle",
        dose_amount=None,
        dose_unit="",
        low_stock_threshold=1,
        notes="Includes a pending demo extraction that needs review.",
    ),
]

DEMO_SCHEDULES = {
    "Morning Vitamin D": ScheduleCreate(
        times=["08:00"],
        days_of_week=[0, 1, 2, 3, 4, 5, 6],
        start_date=date.today(),
        end_date=None,
    ),
    "Evening Allergy Tablet": ScheduleCreate(
        times=["20:00"],
        days_of_week=[0, 1, 2, 3, 4, 5, 6],
        start_date=date.today(),
        end_date=None,
    ),
    "Reviewed Leaflet Sample": ScheduleCreate(
        times=["12:30"],
        days_of_week=[0, 1, 2, 3, 4, 5, 6],
        start_date=date.today(),
        end_date=None,
    ),
}

DEMO_LEAFLET_TEXT = """MedShelf sample leaflet fixture
Demo-only text for testing upload and review workflows.

Medicine name:
Sample Relief Capsule

Active ingredient:
Example active ingredient 10 mg.

Directions:
Follow the directions on the package label or the plan from your clinician or
pharmacist.

Warnings:
Do not use this demo text as medical advice. Ask a clinician or pharmacist if
the leaflet and your prescribed plan do not match.

Storage:
Store in a cool, dry place away from children.
"""


DEMO_PARSED_LEAFLET_OUTPUT: dict[str, Any] = {
    "medicine_name": {
        "value": "Sample Relief Capsule",
        "source_snippet": "Sample Relief Capsule",
        "confidence": "high",
    },
    "active_ingredients": [
        {
            "name": "Example active ingredient",
            "strength": "10 mg",
            "source_snippet": "Example active ingredient 10 mg.",
            "confidence": "high",
        }
    ],
    "usage_instructions": [
        {
            "instruction": (
                "Follow the directions on the package label or the plan from "
                "your clinician or pharmacist."
            ),
            "source_snippet": (
                "Follow the directions on the package label or the plan from "
                "your clinician or pharmacist."
            ),
            "confidence": "medium",
        }
    ],
    "warnings": [
        {
            "warning": (
                "Do not use this demo text as medical advice. Ask a clinician "
                "or pharmacist if the leaflet and your prescribed plan do not match."
            ),
            "severity": "caution",
            "source_snippet": (
                "Do not use this demo text as medical advice. Ask a clinician "
                "or pharmacist if the leaflet and your prescribed plan do not match."
            ),
            "confidence": "medium",
        }
    ],
    "contraindications": [],
    "side_effects": [],
    "storage": [
        {
            "text": "Store in a cool, dry place away from children.",
            "source_snippet": "Store in a cool, dry place away from children.",
            "confidence": "medium",
        }
    ],
    "plain_language_summary": (
        "Demo-reviewed summary: compare the package leaflet with the user's "
        "clinician or pharmacist plan before using these notes."
    ),
    "translated_summary": (
        "No translation was needed for the demo fixture. Keep translations "
        "reviewable before saving."
    ),
    "needs_review": True,
    "review_notes": [
        "Demo extraction seeded for screenshots.",
        "Source snippets were preserved for each kept claim.",
    ],
}


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def row_to_medication(row: Row) -> dict[str, Any]:
    medication = {column: row[column] for column in MEDICATION_COLUMNS}
    medication["is_routine"] = bool(medication["is_routine"])
    threshold = medication["low_stock_threshold"]
    medication["is_low_stock"] = (
        threshold is not None and medication["quantity_remaining"] <= threshold
    )
    return medication


def row_to_schedule(row: Row) -> dict[str, Any]:
    schedule = {column: row[column] for column in SCHEDULE_COLUMNS}
    schedule["times"] = json.loads(schedule["times"])
    schedule["days_of_week"] = json.loads(schedule["days_of_week"])
    return schedule


def row_to_dose_log(row: Row) -> dict[str, Any]:
    return {column: row[column] for column in DOSE_LOG_COLUMNS}


def row_to_leaflet_upload(row: Row) -> dict[str, Any]:
    return {column: row[column] for column in LEAFLET_UPLOAD_COLUMNS}


def row_to_leaflet_extraction(row: Row) -> dict[str, Any]:
    extraction = {column: row[column] for column in LEAFLET_EXTRACTION_COLUMNS}
    parsed_output = extraction["parsed_output"]
    if parsed_output:
        try:
            extraction["parsed_output"] = json.loads(parsed_output)
        except json.JSONDecodeError:
            extraction["parsed_output"] = None
    return extraction


def row_to_leaflet_guidance(row: Row) -> dict[str, Any]:
    guidance = {column: row[column] for column in LEAFLET_GUIDANCE_COLUMNS}
    try:
        guidance["guidance"] = json.loads(guidance.pop("reviewed_output"))
    except json.JSONDecodeError:
        guidance["guidance"] = {}
    return guidance


def schedule_time_to_datetime(target_date: date, schedule_time: str) -> datetime:
    hour, minute = [int(value) for value in schedule_time.split(":")]
    local_timezone = datetime.now().astimezone().tzinfo
    return datetime.combine(target_date, time(hour=hour, minute=minute), local_timezone)


def schedule_is_active(schedule: dict[str, Any], target_date: date) -> bool:
    start_date = date.fromisoformat(schedule["start_date"])
    end_date = (
        date.fromisoformat(schedule["end_date"])
        if schedule["end_date"] is not None
        else None
    )
    return (
        start_date <= target_date
        and (end_date is None or end_date >= target_date)
        and target_date.weekday() in schedule["days_of_week"]
    )


def scheduled_quantity_for_date(
    medication: dict[str, Any], schedules: list[dict[str, Any]], target_date: date
) -> float:
    dose_amount = medication["dose_amount"] or 0
    if dose_amount <= 0:
        return 0

    daily_doses = sum(
        len(schedule["times"])
        for schedule in schedules
        if schedule_is_active(schedule, target_date)
    )
    return daily_doses * dose_amount


def estimate_average_daily_usage(
    medication: dict[str, Any],
    schedules: list[dict[str, Any]],
    target_date: date | None = None,
    horizon_days: int = 28,
) -> float | None:
    start_date = target_date or date.today()
    total_usage = sum(
        scheduled_quantity_for_date(
            medication,
            schedules,
            date.fromordinal(start_date.toordinal() + day_offset),
        )
        for day_offset in range(horizon_days)
    )

    if total_usage <= 0:
        return None

    return round(total_usage / horizon_days, 2)


def estimate_days_remaining(
    medication: dict[str, Any],
    schedules: list[dict[str, Any]],
    target_date: date | None = None,
    max_days: int = 365,
) -> float | None:
    start_date = target_date or date.today()
    quantity_remaining = float(medication["quantity_remaining"])

    if quantity_remaining <= 0:
        return 0

    if (medication["dose_amount"] or 0) <= 0:
        return None

    for day_offset in range(max_days):
        current_date = date.fromordinal(start_date.toordinal() + day_offset)
        daily_quantity = scheduled_quantity_for_date(
            medication, schedules, current_date
        )
        if daily_quantity <= 0:
            continue

        if quantity_remaining <= daily_quantity:
            return round(day_offset + (quantity_remaining / daily_quantity), 1)

        quantity_remaining -= daily_quantity

    return None


def apply_inventory_estimates(
    medication: dict[str, Any], schedules: list[dict[str, Any]]
) -> dict[str, Any]:
    if not medication["is_routine"]:
        medication["daily_usage_estimate"] = None
        medication["days_remaining_estimate"] = None
        return medication

    medication["daily_usage_estimate"] = estimate_average_daily_usage(
        medication, schedules
    )
    medication["days_remaining_estimate"] = estimate_days_remaining(
        medication, schedules
    )
    return medication


def list_schedules_for_inventory(
    database_url: str, medication_id: int
) -> list[dict[str, Any]]:
    with get_connection(database_url) as connection:
        rows = connection.execute(
            """
            SELECT id, medication_id, times, days_of_week, start_date, end_date,
                   created_at, updated_at
            FROM schedules
            WHERE medication_id = ?
            ORDER BY start_date ASC, id ASC
            """,
            (medication_id,),
        ).fetchall()

    return [row_to_schedule(row) for row in rows]


def list_medications(database_url: str) -> list[dict[str, Any]]:
    with get_connection(database_url) as connection:
        rows = connection.execute(
            """
            SELECT id, name, active_ingredients, form, strength,
                   is_routine, quantity_remaining, quantity_unit, dose_amount,
                   dose_unit, low_stock_threshold, notes, created_at, updated_at
            FROM medications
            ORDER BY name COLLATE NOCASE ASC, id ASC
            """
        ).fetchall()

    medications = [row_to_medication(row) for row in rows]
    return [
        apply_inventory_estimates(
            medication, list_schedules_for_inventory(database_url, medication["id"])
        )
        for medication in medications
    ]


def get_medication(database_url: str, medication_id: int) -> dict[str, Any] | None:
    with get_connection(database_url) as connection:
        row = connection.execute(
            """
            SELECT id, name, active_ingredients, form, strength,
                   is_routine, quantity_remaining, quantity_unit, dose_amount,
                   dose_unit, low_stock_threshold, notes, created_at, updated_at
            FROM medications
            WHERE id = ?
            """,
            (medication_id,),
        ).fetchone()

    if row is None:
        return None

    medication = row_to_medication(row)
    return apply_inventory_estimates(
        medication, list_schedules_for_inventory(database_url, medication_id)
    )


def create_medication(
    database_url: str, medication: MedicationCreate
) -> dict[str, Any]:
    timestamp = now_iso()
    data = medication.dict()

    with get_connection(database_url) as connection:
        cursor = connection.execute(
            """
            INSERT INTO medications (
                name, active_ingredients, form, strength, is_routine,
                quantity_remaining, quantity_unit, dose_amount, dose_unit,
                low_stock_threshold, notes, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                data["name"],
                data["active_ingredients"],
                data["form"],
                data["strength"],
                data["is_routine"],
                data["quantity_remaining"],
                data["quantity_unit"],
                data["dose_amount"],
                data["dose_unit"],
                data["low_stock_threshold"],
                data["notes"],
                timestamp,
                timestamp,
            ),
        )
        connection.commit()
        medication_id = int(cursor.lastrowid)

    created = get_medication(database_url, medication_id)
    if created is None:
        raise RuntimeError("Created medication could not be loaded.")

    return created


def update_medication(
    database_url: str, medication_id: int, medication: MedicationUpdate
) -> dict[str, Any] | None:
    existing = get_medication(database_url, medication_id)
    if existing is None:
        return None

    changes = medication.dict(exclude_unset=True)
    if not changes:
        return existing

    changes["updated_at"] = now_iso()
    assignments = ", ".join(f"{field} = ?" for field in changes)
    values = list(changes.values())
    values.append(medication_id)

    with get_connection(database_url) as connection:
        connection.execute(
            f"UPDATE medications SET {assignments} WHERE id = ?",
            values,
        )
        connection.commit()

    return get_medication(database_url, medication_id)


def list_schedules_for_medication(
    database_url: str, medication_id: int
) -> list[dict[str, Any]] | None:
    if get_medication(database_url, medication_id) is None:
        return None

    return list_schedules_for_inventory(database_url, medication_id)


def get_schedule(database_url: str, schedule_id: int) -> dict[str, Any] | None:
    with get_connection(database_url) as connection:
        row = connection.execute(
            """
            SELECT id, medication_id, times, days_of_week, start_date, end_date,
                   created_at, updated_at
            FROM schedules
            WHERE id = ?
            """,
            (schedule_id,),
        ).fetchone()

    if row is None:
        return None

    return row_to_schedule(row)


def create_schedule(
    database_url: str, medication_id: int, schedule: ScheduleCreate
) -> dict[str, Any] | None:
    if get_medication(database_url, medication_id) is None:
        return None

    timestamp = now_iso()
    with get_connection(database_url) as connection:
        cursor = connection.execute(
            """
            INSERT INTO schedules (
                medication_id, times, days_of_week, start_date, end_date,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                medication_id,
                json.dumps(schedule.times),
                json.dumps(schedule.days_of_week),
                schedule.start_date.isoformat(),
                schedule.end_date.isoformat() if schedule.end_date else None,
                timestamp,
                timestamp,
            ),
        )
        connection.commit()
        schedule_id = int(cursor.lastrowid)

    return get_schedule(database_url, schedule_id)


def update_schedule(
    database_url: str, schedule_id: int, schedule: ScheduleUpdate
) -> dict[str, Any] | None:
    existing = get_schedule(database_url, schedule_id)
    if existing is None:
        return None

    changes = schedule.dict(exclude_unset=True)
    if not changes:
        return existing

    start_date = changes.get("start_date", date.fromisoformat(existing["start_date"]))
    end_date = changes.get(
        "end_date",
        date.fromisoformat(existing["end_date"]) if existing["end_date"] else None,
    )
    if end_date is not None and start_date is not None and end_date < start_date:
        raise ValueError("End date cannot be before start date.")

    if "times" in changes:
        changes["times"] = json.dumps(changes["times"])
    if "days_of_week" in changes:
        changes["days_of_week"] = json.dumps(changes["days_of_week"])
    if "start_date" in changes:
        changes["start_date"] = changes["start_date"].isoformat()
    if "end_date" in changes and changes["end_date"] is not None:
        changes["end_date"] = changes["end_date"].isoformat()

    changes["updated_at"] = now_iso()
    assignments = ", ".join(f"{field} = ?" for field in changes)
    values = list(changes.values())
    values.append(schedule_id)

    with get_connection(database_url) as connection:
        connection.execute(
            f"UPDATE schedules SET {assignments} WHERE id = ?",
            values,
        )
        connection.commit()

    return get_schedule(database_url, schedule_id)


def delete_schedule(database_url: str, schedule_id: int) -> bool:
    with get_connection(database_url) as connection:
        cursor = connection.execute(
            "DELETE FROM schedules WHERE id = ?",
            (schedule_id,),
        )
        connection.commit()
        return cursor.rowcount > 0


def get_dose_log(
    database_url: str, schedule_id: int, scheduled_at: str
) -> dict[str, Any] | None:
    with get_connection(database_url) as connection:
        row = connection.execute(
            """
            SELECT id, medication_id, schedule_id, scheduled_at, taken_at, status,
                   quantity_delta, created_at, updated_at
            FROM dose_logs
            WHERE schedule_id = ? AND scheduled_at = ?
            """,
            (schedule_id, scheduled_at),
        ).fetchone()

    if row is None:
        return None

    return row_to_dose_log(row)


def record_dose_action(
    database_url: str, medication_id: int, action: DoseActionCreate
) -> dict[str, Any] | None:
    schedule = get_schedule(database_url, action.schedule_id)
    if schedule is None or schedule["medication_id"] != medication_id:
        return None

    medication = get_medication(database_url, medication_id)
    if medication is None:
        return None

    scheduled_at = action.scheduled_at.isoformat()
    timestamp = now_iso()
    taken_at = timestamp if action.status == "taken" else None
    dose_amount = medication["dose_amount"] or 0
    medication_quantity = float(medication["quantity_remaining"])

    with get_connection(database_url) as connection:
        existing = connection.execute(
            """
            SELECT id, quantity_delta
            FROM dose_logs
            WHERE schedule_id = ? AND scheduled_at = ?
            """,
            (action.schedule_id, scheduled_at),
        ).fetchone()
        previous_quantity_delta = existing["quantity_delta"] if existing else 0
        quantity_before_current_log = medication_quantity - previous_quantity_delta
        applied_dose_amount = min(dose_amount, max(0, quantity_before_current_log))
        new_quantity_delta = -applied_dose_amount if action.status == "taken" else 0
        inventory_adjustment = new_quantity_delta - previous_quantity_delta

        if inventory_adjustment != 0:
            next_quantity = medication_quantity + inventory_adjustment
            connection.execute(
                """
                UPDATE medications
                SET quantity_remaining = ?, updated_at = ?
                WHERE id = ?
                """,
                (next_quantity, timestamp, medication_id),
            )

        if existing:
            connection.execute(
                """
                UPDATE dose_logs
                SET status = ?, taken_at = ?, quantity_delta = ?, updated_at = ?
                WHERE id = ?
                """,
                (
                    action.status,
                    taken_at,
                    new_quantity_delta,
                    timestamp,
                    existing["id"],
                ),
            )
        else:
            connection.execute(
                """
                INSERT INTO dose_logs (
                    medication_id, schedule_id, scheduled_at, taken_at, status,
                    quantity_delta, created_at, updated_at
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    medication_id,
                    action.schedule_id,
                    scheduled_at,
                    taken_at,
                    action.status,
                    new_quantity_delta,
                    timestamp,
                    timestamp,
                ),
            )
        connection.commit()

    return get_dose_log(database_url, action.schedule_id, scheduled_at)


def get_today_dashboard(
    database_url: str, target_date: date | None = None
) -> dict[str, Any]:
    dashboard_date = target_date or date.today()
    generated_at = datetime.now().astimezone()

    with get_connection(database_url) as connection:
        schedule_rows = connection.execute(
            """
            SELECT
                s.id AS schedule_id,
                s.medication_id AS medication_id,
                s.times AS times,
                s.days_of_week AS days_of_week,
                s.start_date AS start_date,
                s.end_date AS end_date,
                m.name AS medication_name,
                m.form AS form,
                m.strength AS strength,
                m.quantity_remaining AS quantity_remaining,
                m.quantity_unit AS quantity_unit,
                m.dose_amount AS dose_amount,
                m.dose_unit AS dose_unit
            FROM schedules s
            JOIN medications m ON m.id = s.medication_id
            WHERE s.start_date <= ?
              AND (s.end_date IS NULL OR s.end_date >= ?)
            ORDER BY s.id ASC
            """,
            (dashboard_date.isoformat(), dashboard_date.isoformat()),
        ).fetchall()
        log_rows = connection.execute(
            """
            SELECT id, medication_id, schedule_id, scheduled_at, taken_at, status,
                   quantity_delta, created_at, updated_at
            FROM dose_logs
            WHERE substr(scheduled_at, 1, 10) = ?
            """,
            (dashboard_date.isoformat(),),
        ).fetchall()

    logs_by_key = {
        (row["schedule_id"], row["scheduled_at"]): row_to_dose_log(row)
        for row in log_rows
    }

    doses: list[dict[str, Any]] = []
    for row in schedule_rows:
        schedule = {
            "id": row["schedule_id"],
            "start_date": row["start_date"],
            "end_date": row["end_date"],
            "times": json.loads(row["times"]),
            "days_of_week": json.loads(row["days_of_week"]),
        }
        if not schedule_is_active(schedule, dashboard_date):
            continue

        for schedule_time in schedule["times"]:
            scheduled_at = schedule_time_to_datetime(dashboard_date, schedule_time)
            scheduled_at_iso = scheduled_at.isoformat()
            log = logs_by_key.get((row["schedule_id"], scheduled_at_iso))

            if log is not None:
                status = log["status"]
                logged_at = log["updated_at"]
                quantity_delta = log["quantity_delta"]
            else:
                status = "missed" if scheduled_at < generated_at else "due"
                logged_at = None
                quantity_delta = None

            doses.append(
                {
                    "dose_key": f"{row['schedule_id']}:{scheduled_at_iso}",
                    "medication_id": row["medication_id"],
                    "medication_name": row["medication_name"],
                    "form": row["form"],
                    "strength": row["strength"],
                    "quantity_remaining": row["quantity_remaining"],
                    "quantity_unit": row["quantity_unit"],
                    "dose_amount": row["dose_amount"],
                    "dose_unit": row["dose_unit"],
                    "schedule_id": row["schedule_id"],
                    "scheduled_at": scheduled_at_iso,
                    "status": status,
                    "logged_at": logged_at,
                    "quantity_delta": quantity_delta,
                }
            )

    doses.sort(key=lambda dose: (dose["scheduled_at"], dose["medication_name"]))
    return {
        "date": dashboard_date,
        "generated_at": generated_at,
        "doses": doses,
    }


def build_restock_suggestion(
    database_url: str, medication_id: int, region: str = ""
) -> dict[str, Any] | None:
    medication = get_medication(database_url, medication_id)
    if medication is None:
        return None

    search_parts = [
        medication["name"],
        medication["strength"],
        medication["form"],
        medication["quantity_unit"],
        "pharmacy",
        region.strip(),
    ]
    search_query = " ".join(part for part in search_parts if part)
    encoded_query = quote_plus(search_query)
    maps_query = quote_plus(f"{medication['name']} pharmacy {region.strip()}".strip())

    return {
        "medication_id": medication["id"],
        "medication_name": medication["name"],
        "is_low_stock": medication["is_low_stock"],
        "quantity_remaining": medication["quantity_remaining"],
        "quantity_unit": medication["quantity_unit"],
        "low_stock_threshold": medication["low_stock_threshold"],
        "daily_usage_estimate": medication["daily_usage_estimate"],
        "days_remaining_estimate": medication["days_remaining_estimate"],
        "search_query": search_query,
        "links": [
            {
                "label": "Google search",
                "url": f"https://www.google.com/search?q={encoded_query}",
            },
            {
                "label": "Pharmacy search",
                "url": f"https://www.google.com/search?q={encoded_query}+near+me",
            },
            {
                "label": "Map search",
                "url": f"https://www.google.com/maps/search/?api=1&query={maps_query}",
            },
        ],
        "safety_note": (
            "Use these links to find restock options, then confirm availability, "
            "substitution, and dosing questions with a pharmacist or clinician."
        ),
    }


def get_leaflet_upload(database_url: str, leaflet_id: int) -> dict[str, Any] | None:
    with get_connection(database_url) as connection:
        row = connection.execute(
            """
            SELECT id, medication_id, original_filename, stored_filename,
                   source_file_path, content_type, size_bytes, status,
                   created_at, updated_at
            FROM leaflet_uploads
            WHERE id = ?
            """,
            (leaflet_id,),
        ).fetchone()

    if row is None:
        return None

    return row_to_leaflet_upload(row)


def list_leaflet_uploads_for_medication(
    database_url: str, medication_id: int
) -> list[dict[str, Any]] | None:
    if get_medication(database_url, medication_id) is None:
        return None

    with get_connection(database_url) as connection:
        rows = connection.execute(
            """
            SELECT id, medication_id, original_filename, stored_filename,
                   source_file_path, content_type, size_bytes, status,
                   created_at, updated_at
            FROM leaflet_uploads
            WHERE medication_id = ?
            ORDER BY created_at DESC, id DESC
            """,
            (medication_id,),
        ).fetchall()

    return [row_to_leaflet_upload(row) for row in rows]


def create_leaflet_upload(
    database_url: str,
    medication_id: int,
    original_filename: str,
    stored_filename: str,
    source_file_path: str,
    content_type: str,
    size_bytes: int,
    status: str = "uploaded",
) -> dict[str, Any] | None:
    if get_medication(database_url, medication_id) is None:
        return None

    timestamp = now_iso()
    with get_connection(database_url) as connection:
        cursor = connection.execute(
            """
            INSERT INTO leaflet_uploads (
                medication_id, original_filename, stored_filename,
                source_file_path, content_type, size_bytes, status,
                created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                medication_id,
                original_filename,
                stored_filename,
                source_file_path,
                content_type,
                size_bytes,
                status,
                timestamp,
                timestamp,
            ),
        )
        connection.commit()
        leaflet_id = int(cursor.lastrowid)

    created = get_leaflet_upload(database_url, leaflet_id)
    if created is None:
        raise RuntimeError("Created leaflet upload could not be loaded.")

    return created


def get_leaflet_extraction(
    database_url: str, extraction_id: int
) -> dict[str, Any] | None:
    with get_connection(database_url) as connection:
        row = connection.execute(
            """
            SELECT id, leaflet_upload_id, medication_id, provider, status,
                   source_text, raw_model_output, parsed_output, error_message,
                   created_at, updated_at
            FROM leaflet_extractions
            WHERE id = ?
            """,
            (extraction_id,),
        ).fetchone()

    if row is None:
        return None

    return row_to_leaflet_extraction(row)


def get_latest_leaflet_extraction_for_upload(
    database_url: str, leaflet_id: int
) -> dict[str, Any] | None:
    if get_leaflet_upload(database_url, leaflet_id) is None:
        return None

    with get_connection(database_url) as connection:
        row = connection.execute(
            """
            SELECT id, leaflet_upload_id, medication_id, provider, status,
                   source_text, raw_model_output, parsed_output, error_message,
                   created_at, updated_at
            FROM leaflet_extractions
            WHERE leaflet_upload_id = ?
            ORDER BY created_at DESC, id DESC
            LIMIT 1
            """,
            (leaflet_id,),
        ).fetchone()

    if row is None:
        return None

    return row_to_leaflet_extraction(row)


def list_leaflet_guidance_for_medication(
    database_url: str, medication_id: int
) -> list[dict[str, Any]] | None:
    if get_medication(database_url, medication_id) is None:
        return None

    with get_connection(database_url) as connection:
        rows = connection.execute(
            """
            SELECT id, medication_id, leaflet_upload_id, leaflet_extraction_id,
                   reviewed_output, created_at, updated_at
            FROM leaflet_guidance
            WHERE medication_id = ?
            ORDER BY updated_at DESC, id DESC
            """,
            (medication_id,),
        ).fetchall()

    return [row_to_leaflet_guidance(row) for row in rows]


def approve_leaflet_guidance(
    database_url: str,
    leaflet_id: int,
    extraction_id: int,
    reviewed_output: dict[str, Any],
) -> dict[str, Any] | None:
    timestamp = now_iso()
    reviewed_json = json.dumps(reviewed_output, ensure_ascii=False)

    with get_connection(database_url) as connection:
        extraction = connection.execute(
            """
            SELECT id, leaflet_upload_id, medication_id, status, parsed_output
            FROM leaflet_extractions
            WHERE id = ?
            """,
            (extraction_id,),
        ).fetchone()
        if extraction is None or extraction["leaflet_upload_id"] != leaflet_id:
            return None
        if extraction["status"] != "needs_review" or not extraction["parsed_output"]:
            raise ValueError("Only needs_review extractions can be approved.")

        cursor = connection.execute(
            """
            INSERT INTO leaflet_guidance (
                medication_id, leaflet_upload_id, leaflet_extraction_id,
                reviewed_output, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(leaflet_extraction_id) DO UPDATE SET
                reviewed_output = excluded.reviewed_output,
                updated_at = excluded.updated_at
            """,
            (
                extraction["medication_id"],
                leaflet_id,
                extraction_id,
                reviewed_json,
                timestamp,
                timestamp,
            ),
        )
        guidance_id = int(cursor.lastrowid)
        connection.execute(
            """
            UPDATE leaflet_extractions
            SET status = ?, updated_at = ?
            WHERE id = ?
            """,
            ("approved", timestamp, extraction_id),
        )
        connection.execute(
            """
            UPDATE leaflet_uploads
            SET status = ?, updated_at = ?
            WHERE id = ?
            """,
            ("approved", timestamp, leaflet_id),
        )
        connection.commit()

    if guidance_id == 0:
        with get_connection(database_url) as connection:
            row = connection.execute(
                """
                SELECT id, medication_id, leaflet_upload_id,
                       leaflet_extraction_id, reviewed_output, created_at,
                       updated_at
                FROM leaflet_guidance
                WHERE leaflet_extraction_id = ?
                """,
                (extraction_id,),
            ).fetchone()
    else:
        with get_connection(database_url) as connection:
            row = connection.execute(
                """
                SELECT id, medication_id, leaflet_upload_id,
                       leaflet_extraction_id, reviewed_output, created_at,
                       updated_at
                FROM leaflet_guidance
                WHERE id = ?
                """,
                (guidance_id,),
            ).fetchone()

    if row is None:
        raise RuntimeError("Approved leaflet guidance could not be loaded.")

    return row_to_leaflet_guidance(row)


def create_leaflet_extraction_attempt(
    database_url: str, leaflet_upload: dict[str, Any], provider: str
) -> dict[str, Any]:
    timestamp = now_iso()
    with get_connection(database_url) as connection:
        cursor = connection.execute(
            """
            INSERT INTO leaflet_extractions (
                leaflet_upload_id, medication_id, provider, status, source_text,
                raw_model_output, parsed_output, error_message, created_at,
                updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                leaflet_upload["id"],
                leaflet_upload["medication_id"],
                provider,
                "extracting",
                "",
                "",
                None,
                "",
                timestamp,
                timestamp,
            ),
        )
        connection.execute(
            """
            UPDATE leaflet_uploads
            SET status = ?, updated_at = ?
            WHERE id = ?
            """,
            ("extracting", timestamp, leaflet_upload["id"]),
        )
        connection.commit()
        extraction_id = int(cursor.lastrowid)

    created = get_leaflet_extraction(database_url, extraction_id)
    if created is None:
        raise RuntimeError("Created leaflet extraction could not be loaded.")

    return created


def complete_leaflet_extraction(
    database_url: str,
    extraction_id: int,
    status: str,
    source_text: str = "",
    raw_model_output: str = "",
    parsed_output: dict[str, Any] | None = None,
    error_message: str = "",
) -> dict[str, Any] | None:
    timestamp = now_iso()
    parsed_json = (
        json.dumps(parsed_output, ensure_ascii=False) if parsed_output is not None else None
    )

    with get_connection(database_url) as connection:
        existing = connection.execute(
            """
            SELECT leaflet_upload_id
            FROM leaflet_extractions
            WHERE id = ?
            """,
            (extraction_id,),
        ).fetchone()
        if existing is None:
            return None

        connection.execute(
            """
            UPDATE leaflet_extractions
            SET status = ?, source_text = ?, raw_model_output = ?,
                parsed_output = ?, error_message = ?, updated_at = ?
            WHERE id = ?
            """,
            (
                status,
                source_text,
                raw_model_output,
                parsed_json,
                error_message,
                timestamp,
                extraction_id,
            ),
        )
        connection.execute(
            """
            UPDATE leaflet_uploads
            SET status = ?, updated_at = ?
            WHERE id = ?
            """,
            (status, timestamp, existing["leaflet_upload_id"]),
        )
        connection.commit()

    return get_leaflet_extraction(database_url, extraction_id)


def delete_medication(database_url: str, medication_id: int) -> bool:
    with get_connection(database_url) as connection:
        cursor = connection.execute(
            "DELETE FROM medications WHERE id = ?",
            (medication_id,),
        )
        connection.commit()
        return cursor.rowcount > 0


def seed_demo_schedules(database_url: str) -> None:
    with get_connection(database_url) as connection:
        medication_rows = connection.execute(
            "SELECT id, name FROM medications WHERE name IN (?, ?, ?)",
            tuple(DEMO_SCHEDULES.keys()),
        ).fetchall()

    medication_ids_by_name = {row["name"]: row["id"] for row in medication_rows}
    for medication_name, schedule in DEMO_SCHEDULES.items():
        medication_id = medication_ids_by_name.get(medication_name)
        if medication_id is None:
            continue

        with get_connection(database_url) as connection:
            schedule_count = connection.execute(
                "SELECT COUNT(*) FROM schedules WHERE medication_id = ?",
                (medication_id,),
            ).fetchone()[0]

        if schedule_count == 0:
            create_schedule(database_url, medication_id, schedule)


def demo_leaflet_file(upload_dir: str, filename: str) -> tuple[str, int]:
    upload_path = Path(upload_dir).expanduser()
    if not upload_path.is_absolute():
        upload_path = Path.cwd() / upload_path
    upload_path.mkdir(parents=True, exist_ok=True)

    file_path = upload_path / filename
    file_bytes = DEMO_LEAFLET_TEXT.encode("utf-8")
    file_path.write_bytes(file_bytes)
    return str(file_path), len(file_bytes)


def clear_upload_directory(upload_dir: str) -> None:
    upload_path = Path(upload_dir).expanduser()
    if not upload_path.is_absolute():
        upload_path = Path.cwd() / upload_path
    upload_path = upload_path.resolve()

    unsafe_targets = {
        Path("/").resolve(),
        Path("/tmp").resolve(),
        Path.cwd().resolve(),
        Path.home().resolve(),
    }
    if upload_path in unsafe_targets or not upload_path.exists():
        return

    for child in upload_path.iterdir():
        if child.is_dir() and not child.is_symlink():
            shutil.rmtree(child)
        else:
            child.unlink(missing_ok=True)


def seed_demo_leaflets(database_url: str, upload_dir: str) -> None:
    with get_connection(database_url) as connection:
        medication_rows = connection.execute(
            """
            SELECT id, name
            FROM medications
            WHERE name IN (?, ?)
            """,
            ("Reviewed Leaflet Sample", "Pending Leaflet Sample"),
        ).fetchall()

    medication_ids_by_name = {row["name"]: row["id"] for row in medication_rows}
    reviewed_id = medication_ids_by_name.get("Reviewed Leaflet Sample")
    pending_id = medication_ids_by_name.get("Pending Leaflet Sample")

    if reviewed_id is not None:
        seed_reviewed_demo_leaflet(database_url, upload_dir, reviewed_id)
    if pending_id is not None:
        seed_pending_demo_leaflet(database_url, upload_dir, pending_id)


def seed_reviewed_demo_leaflet(
    database_url: str, upload_dir: str, medication_id: int
) -> None:
    existing_guidance = list_leaflet_guidance_for_medication(database_url, medication_id)
    if existing_guidance:
        return

    source_file_path, size_bytes = demo_leaflet_file(
        upload_dir, "demo-reviewed-leaflet.txt"
    )
    upload = create_leaflet_upload(
        database_url,
        medication_id=medication_id,
        original_filename="demo-reviewed-leaflet.txt",
        stored_filename="demo-reviewed-leaflet.txt",
        source_file_path=source_file_path,
        content_type="text/plain",
        size_bytes=size_bytes,
        status="uploaded",
    )
    if upload is None:
        return

    extraction = create_leaflet_extraction_attempt(database_url, upload, "mock")
    completed = complete_leaflet_extraction(
        database_url,
        extraction["id"],
        status="needs_review",
        source_text=DEMO_LEAFLET_TEXT,
        raw_model_output=json.dumps(
            {
                "provider": "mock",
                "demo": True,
                "parsed_output": DEMO_PARSED_LEAFLET_OUTPUT,
            },
            ensure_ascii=False,
        ),
        parsed_output=DEMO_PARSED_LEAFLET_OUTPUT,
        error_message="",
    )
    if completed is None:
        return

    reviewed_output = {
        **DEMO_PARSED_LEAFLET_OUTPUT,
        "needs_review": False,
        "plain_language_summary": (
            "Reviewed demo guidance: use the package label and clinician or "
            "pharmacist plan as the source of truth. This saved note keeps the "
            "leaflet warning visible with its source snippet."
        ),
        "review_notes": [
            "Demo reviewer confirmed the source snippets are visible.",
            "No dosing was inferred beyond the leaflet text.",
        ],
    }
    approve_leaflet_guidance(
        database_url,
        upload["id"],
        completed["id"],
        reviewed_output,
    )


def seed_pending_demo_leaflet(
    database_url: str, upload_dir: str, medication_id: int
) -> None:
    uploads = list_leaflet_uploads_for_medication(database_url, medication_id)
    if uploads:
        return

    source_file_path, size_bytes = demo_leaflet_file(
        upload_dir, "demo-pending-leaflet.txt"
    )
    upload = create_leaflet_upload(
        database_url,
        medication_id=medication_id,
        original_filename="demo-pending-leaflet.txt",
        stored_filename="demo-pending-leaflet.txt",
        source_file_path=source_file_path,
        content_type="text/plain",
        size_bytes=size_bytes,
        status="uploaded",
    )
    if upload is None:
        return

    extraction = create_leaflet_extraction_attempt(database_url, upload, "mock")
    complete_leaflet_extraction(
        database_url,
        extraction["id"],
        status="needs_review",
        source_text=DEMO_LEAFLET_TEXT,
        raw_model_output=json.dumps(
            {
                "provider": "mock",
                "demo": True,
                "parsed_output": DEMO_PARSED_LEAFLET_OUTPUT,
            },
            ensure_ascii=False,
        ),
        parsed_output=DEMO_PARSED_LEAFLET_OUTPUT,
        error_message="",
    )


def seed_demo_medications(
    database_url: str,
    reset: bool = False,
    leaflet_upload_dir: str = "./uploads/leaflets",
) -> list[dict[str, Any]]:
    with get_connection(database_url) as connection:
        if reset:
            connection.execute("DELETE FROM leaflet_guidance")
            connection.execute("DELETE FROM leaflet_extractions")
            connection.execute("DELETE FROM leaflet_uploads")
            connection.execute("DELETE FROM dose_logs")
            connection.execute("DELETE FROM schedules")
            connection.execute("DELETE FROM medications")
            connection.commit()
            clear_upload_directory(leaflet_upload_dir)

        existing_rows = connection.execute(
            "SELECT name FROM medications WHERE name IN (?, ?, ?, ?)",
            tuple(medication.name for medication in DEMO_MEDICATIONS),
        ).fetchall()

    existing_demo_names = {row["name"] for row in existing_rows}
    for medication in DEMO_MEDICATIONS:
        if medication.name not in existing_demo_names:
            create_medication(database_url, medication)

    seed_demo_schedules(database_url)
    seed_demo_leaflets(database_url, leaflet_upload_dir)

    return list_medications(database_url)
