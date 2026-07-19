from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, validator


class MedicationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    active_ingredients: str = Field("", max_length=240)
    form: str = Field("", max_length=80)
    strength: str = Field("", max_length=80)
    quantity_remaining: float = Field(0, ge=0)
    quantity_unit: str = Field("units", min_length=1, max_length=40)
    dose_amount: Optional[float] = Field(None, ge=0)
    dose_unit: str = Field("", max_length=40)
    low_stock_threshold: Optional[float] = Field(None, ge=0)
    notes: str = Field("", max_length=1000)

    @validator(
        "name",
        "active_ingredients",
        "form",
        "strength",
        "quantity_unit",
        "dose_unit",
        "notes",
        pre=True,
    )
    def normalize_text(cls, value: object) -> str:
        if value is None:
            return ""
        return str(value).strip()

    @validator("name")
    def name_is_required(cls, value: str) -> str:
        if not value:
            raise ValueError("Medication name is required.")
        return value

    @validator("quantity_unit")
    def quantity_unit_is_required(cls, value: str) -> str:
        if not value:
            raise ValueError("Quantity unit is required.")
        return value


class MedicationCreate(MedicationBase):
    pass


class MedicationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=120)
    active_ingredients: Optional[str] = Field(None, max_length=240)
    form: Optional[str] = Field(None, max_length=80)
    strength: Optional[str] = Field(None, max_length=80)
    quantity_remaining: Optional[float] = Field(None, ge=0)
    quantity_unit: Optional[str] = Field(None, min_length=1, max_length=40)
    dose_amount: Optional[float] = Field(None, ge=0)
    dose_unit: Optional[str] = Field(None, max_length=40)
    low_stock_threshold: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=1000)

    @validator(
        "name",
        "active_ingredients",
        "form",
        "strength",
        "quantity_unit",
        "dose_unit",
        "notes",
        pre=True,
    )
    def normalize_optional_text(cls, value: object) -> object:
        if value is None:
            return value
        return str(value).strip()


class MedicationRead(MedicationBase):
    id: int
    is_low_stock: bool
    daily_usage_estimate: Optional[float] = None
    days_remaining_estimate: Optional[float] = None
    created_at: datetime
    updated_at: datetime


def normalize_time(value: str) -> str:
    normalized = value.strip()
    try:
        datetime.strptime(normalized, "%H:%M")
    except ValueError as exc:
        raise ValueError("Times must use HH:MM format.") from exc
    return normalized


def normalize_days(days: list[int]) -> list[int]:
    unique_days = sorted(set(days))
    if not unique_days:
        raise ValueError("At least one day of week is required.")
    if any(day < 0 or day > 6 for day in unique_days):
        raise ValueError("Days of week must be 0-6 where Monday is 0.")
    return unique_days


class ScheduleBase(BaseModel):
    times: list[str] = Field(..., min_items=1)
    days_of_week: list[int] = Field(default_factory=lambda: [0, 1, 2, 3, 4, 5, 6])
    start_date: date
    end_date: Optional[date] = None

    @validator("times")
    def validate_times(cls, values: list[str]) -> list[str]:
        normalized_times = sorted({normalize_time(value) for value in values})
        if not normalized_times:
            raise ValueError("At least one schedule time is required.")
        return normalized_times

    @validator("days_of_week")
    def validate_days_of_week(cls, values: list[int]) -> list[int]:
        return normalize_days(values)

    @validator("end_date")
    def end_date_must_not_precede_start(
        cls, value: Optional[date], values: dict
    ) -> Optional[date]:
        start_date = values.get("start_date")
        if value is not None and start_date is not None and value < start_date:
            raise ValueError("End date cannot be before start date.")
        return value


class ScheduleCreate(ScheduleBase):
    pass


class ScheduleUpdate(BaseModel):
    times: Optional[list[str]] = Field(None, min_items=1)
    days_of_week: Optional[list[int]] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None

    @validator("times")
    def validate_optional_times(
        cls, values: Optional[list[str]]
    ) -> Optional[list[str]]:
        if values is None:
            return values
        return sorted({normalize_time(value) for value in values})

    @validator("days_of_week")
    def validate_optional_days(
        cls, values: Optional[list[int]]
    ) -> Optional[list[int]]:
        if values is None:
            return values
        return normalize_days(values)


class ScheduleRead(ScheduleBase):
    id: int
    medication_id: int
    created_at: datetime
    updated_at: datetime


class DoseActionCreate(BaseModel):
    schedule_id: int
    scheduled_at: datetime
    status: Literal["taken", "skipped"]


class DoseLogRead(BaseModel):
    id: int
    medication_id: int
    schedule_id: Optional[int]
    scheduled_at: datetime
    taken_at: Optional[datetime]
    status: Literal["taken", "skipped"]
    quantity_delta: float
    created_at: datetime
    updated_at: datetime


class TodayDoseRead(BaseModel):
    dose_key: str
    medication_id: int
    medication_name: str
    form: str
    strength: str
    quantity_remaining: float
    quantity_unit: str
    dose_amount: Optional[float]
    dose_unit: str
    schedule_id: int
    scheduled_at: datetime
    status: Literal["due", "missed", "taken", "skipped"]
    logged_at: Optional[datetime] = None
    quantity_delta: Optional[float] = None


class TodayDashboardResponse(BaseModel):
    date: date
    generated_at: datetime
    doses: list[TodayDoseRead]


class RestockLink(BaseModel):
    label: str
    url: str


class RestockSuggestionRead(BaseModel):
    medication_id: int
    medication_name: str
    is_low_stock: bool
    quantity_remaining: float
    quantity_unit: str
    low_stock_threshold: Optional[float]
    daily_usage_estimate: Optional[float]
    days_remaining_estimate: Optional[float]
    search_query: str
    links: list[RestockLink]
    safety_note: str


class DemoSeedResponse(BaseModel):
    medications: list[MedicationRead]
