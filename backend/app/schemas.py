from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, Field, validator


class MedicationBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=120)
    active_ingredients: str = Field("", max_length=240)
    form: str = Field("", max_length=80)
    strength: str = Field("", max_length=80)
    is_routine: bool = True
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
    is_routine: Optional[bool] = None
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
    def validate_times(cls, value: list[str]) -> list[str]:
        normalized_times = sorted({normalize_time(item) for item in value})
        if not normalized_times:
            raise ValueError("At least one schedule time is required.")
        return normalized_times

    @validator("days_of_week")
    def validate_days_of_week(cls, value: list[int]) -> list[int]:
        return normalize_days(value)

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
        cls, value: Optional[list[str]]
    ) -> Optional[list[str]]:
        if value is None:
            return value
        return sorted({normalize_time(item) for item in value})

    @validator("days_of_week")
    def validate_optional_days(
        cls, value: Optional[list[int]]
    ) -> Optional[list[int]]:
        if value is None:
            return value
        return normalize_days(value)


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


Confidence = Literal["high", "medium", "low"]
WarningSeverity = Literal["info", "caution", "urgent"]
ExtractionProvider = Literal["browser_ocr", "mock", "local_ocr", "openai"]

LeafletExtractionStatus = Literal[
    "uploaded",
    "queued",
    "extracting",
    "needs_review",
    "failed",
    "approved",
]


class MedicineNameExtraction(BaseModel):
    value: Optional[str] = Field(None, max_length=240)
    source_snippet: Optional[str] = Field(None, max_length=1000)
    confidence: Confidence = "low"

    @validator("value", "source_snippet", pre=True)
    def normalize_optional_text(cls, value: object) -> object:
        if value is None:
            return value
        return str(value).strip()


class ActiveIngredientExtraction(BaseModel):
    name: str = Field(..., min_length=1, max_length=240)
    strength: Optional[str] = Field(None, max_length=120)
    source_snippet: str = Field(..., min_length=1, max_length=1000)
    confidence: Confidence = "low"

    @validator("name", "strength", "source_snippet", pre=True)
    def normalize_text(cls, value: object) -> object:
        if value is None:
            return value
        return str(value).strip()


class UsageInstructionExtraction(BaseModel):
    instruction: str = Field(..., min_length=1, max_length=1200)
    source_snippet: str = Field(..., min_length=1, max_length=1200)
    confidence: Confidence = "low"

    @validator("instruction", "source_snippet", pre=True)
    def normalize_text(cls, value: object) -> object:
        if value is None:
            return value
        return str(value).strip()


class WarningExtraction(BaseModel):
    warning: str = Field(..., min_length=1, max_length=1200)
    severity: WarningSeverity = "caution"
    source_snippet: str = Field(..., min_length=1, max_length=1200)
    confidence: Confidence = "low"

    @validator("warning", "source_snippet", pre=True)
    def normalize_text(cls, value: object) -> object:
        if value is None:
            return value
        return str(value).strip()


class TextClaimExtraction(BaseModel):
    text: str = Field(..., min_length=1, max_length=1200)
    source_snippet: str = Field(..., min_length=1, max_length=1200)
    confidence: Confidence = "low"

    @validator("text", "source_snippet", pre=True)
    def normalize_text(cls, value: object) -> object:
        if value is None:
            return value
        return str(value).strip()


class LeafletParsedOutput(BaseModel):
    medicine_name: MedicineNameExtraction = Field(
        default_factory=MedicineNameExtraction
    )
    active_ingredients: list[ActiveIngredientExtraction] = Field(default_factory=list)
    usage_instructions: list[UsageInstructionExtraction] = Field(default_factory=list)
    warnings: list[WarningExtraction] = Field(default_factory=list)
    contraindications: list[TextClaimExtraction] = Field(default_factory=list)
    side_effects: list[TextClaimExtraction] = Field(default_factory=list)
    storage: list[TextClaimExtraction] = Field(default_factory=list)
    plain_language_summary: str = Field("", max_length=4000)
    translated_summary: str = Field("", max_length=4000)
    needs_review: bool = True
    review_notes: list[str] = Field(default_factory=list)

    @validator("plain_language_summary", "translated_summary", pre=True)
    def normalize_summary(cls, value: object) -> str:
        if value is None:
            return ""
        return str(value).strip()

    @validator("review_notes", pre=True)
    def normalize_review_notes(cls, value: object) -> list[str]:
        if value is None:
            return []
        if not isinstance(value, list):
            return [str(value).strip()]
        return [str(item).strip() for item in value if str(item).strip()]

    @validator("needs_review")
    def extraction_requires_review(cls, value: bool) -> bool:
        if value is not True:
            raise ValueError("AI-derived leaflet output must remain needs_review.")
        return value


class LeafletGuidanceContentBase(BaseModel):
    medicine_name: MedicineNameExtraction = Field(
        default_factory=MedicineNameExtraction
    )
    active_ingredients: list[ActiveIngredientExtraction] = Field(default_factory=list)
    usage_instructions: list[UsageInstructionExtraction] = Field(default_factory=list)
    warnings: list[WarningExtraction] = Field(default_factory=list)
    contraindications: list[TextClaimExtraction] = Field(default_factory=list)
    side_effects: list[TextClaimExtraction] = Field(default_factory=list)
    storage: list[TextClaimExtraction] = Field(default_factory=list)
    plain_language_summary: str = Field("", max_length=4000)
    translated_summary: str = Field("", max_length=4000)
    review_notes: list[str] = Field(default_factory=list)

    @validator("plain_language_summary", "translated_summary", pre=True)
    def normalize_summary(cls, value: object) -> str:
        if value is None:
            return ""
        return str(value).strip()

    @validator("review_notes", pre=True)
    def normalize_review_notes(cls, value: object) -> list[str]:
        if value is None:
            return []
        if not isinstance(value, list):
            return [str(value).strip()]
        return [str(item).strip() for item in value if str(item).strip()]


class LeafletGuidanceApproveRequest(LeafletGuidanceContentBase):
    extraction_id: int


class LeafletApprovedGuidance(LeafletGuidanceContentBase):
    needs_review: Literal[False] = False


class LeafletUploadRead(BaseModel):
    id: int
    medication_id: int
    original_filename: str
    stored_filename: str
    content_type: str
    size_bytes: int
    status: LeafletExtractionStatus
    created_at: datetime
    updated_at: datetime


class LeafletExtractionRead(BaseModel):
    id: int
    leaflet_upload_id: int
    medication_id: int
    provider: ExtractionProvider
    status: LeafletExtractionStatus
    source_text: str
    raw_model_output: str
    parsed_output: Optional[LeafletParsedOutput] = None
    error_message: str
    created_at: datetime
    updated_at: datetime


class LeafletGuidanceRead(BaseModel):
    id: int
    medication_id: int
    leaflet_upload_id: int
    leaflet_extraction_id: int
    guidance: LeafletApprovedGuidance
    created_at: datetime
    updated_at: datetime


class LeafletBrowserOcrExtractRequest(BaseModel):
    source_text: str = Field(..., min_length=1, max_length=60000)

    @validator("source_text", pre=True)
    def normalize_source_text(cls, value: object) -> str:
        return str(value or "").strip()


class DemoSeedResponse(BaseModel):
    medications: list[MedicationRead]
