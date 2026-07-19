from functools import lru_cache
from os import getenv


class Settings:
    app_env: str
    database_url: str
    cors_origins: list[str]
    seed_demo_data: bool

    def __init__(self) -> None:
        self.app_env = getenv("APP_ENV", "development")
        self.database_url = getenv("DATABASE_URL", "sqlite:///./medshelf.db")
        origins = getenv("BACKEND_CORS_ORIGINS", "http://localhost:5173")
        self.cors_origins = [origin.strip() for origin in origins.split(",") if origin.strip()]
        seed_demo_data = getenv("SEED_DEMO_DATA", "true").strip().lower()
        self.seed_demo_data = seed_demo_data in {"1", "true", "yes", "on"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
