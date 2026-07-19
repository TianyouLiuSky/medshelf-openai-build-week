from functools import lru_cache
from os import getenv


class Settings:
    app_env: str
    database_url: str
    cors_origins: list[str]
    seed_demo_data: bool
    leaflet_upload_dir: str
    leaflet_max_upload_bytes: int
    extraction_provider: str
    local_ocr_command: str
    local_ocr_timeout_seconds: int
    openai_api_key: str
    openai_api_base_url: str
    openai_extraction_model: str

    def __init__(self) -> None:
        self.app_env = getenv("APP_ENV", "development")
        self.database_url = getenv("DATABASE_URL", "sqlite:///./medshelf.db")
        origins = getenv("BACKEND_CORS_ORIGINS", "http://localhost:5173")
        self.cors_origins = [origin.strip() for origin in origins.split(",") if origin.strip()]
        seed_demo_data = getenv("SEED_DEMO_DATA", "true").strip().lower()
        self.seed_demo_data = seed_demo_data in {"1", "true", "yes", "on"}
        self.leaflet_upload_dir = getenv("LEAFLET_UPLOAD_DIR", "./uploads/leaflets")
        max_bytes = getenv("LEAFLET_MAX_UPLOAD_BYTES", "10000000")
        try:
            self.leaflet_max_upload_bytes = max(1, int(max_bytes))
        except ValueError:
            self.leaflet_max_upload_bytes = 10000000
        self.extraction_provider = getenv("EXTRACTION_PROVIDER", "mock").strip().lower()
        self.local_ocr_command = getenv("LOCAL_OCR_COMMAND", "tesseract").strip()
        timeout_seconds = getenv("LOCAL_OCR_TIMEOUT_SECONDS", "20")
        try:
            self.local_ocr_timeout_seconds = max(1, int(timeout_seconds))
        except ValueError:
            self.local_ocr_timeout_seconds = 20
        self.openai_api_key = getenv("OPENAI_API_KEY", "").strip()
        self.openai_api_base_url = getenv(
            "OPENAI_API_BASE_URL", "https://api.openai.com/v1"
        ).strip()
        self.openai_extraction_model = getenv(
            "OPENAI_EXTRACTION_MODEL", "gpt-4o-mini"
        ).strip()


@lru_cache
def get_settings() -> Settings:
    return Settings()
