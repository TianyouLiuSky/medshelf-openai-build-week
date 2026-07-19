from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .database import init_db
from .repository import seed_demo_medications
from .routes import dashboard, demo, doses, leaflets, medications, restock, schedules
from .settings import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = app.state.settings
    init_db(settings.database_url)
    if settings.seed_demo_data:
        seed_demo_medications(settings.database_url)
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="MedShelf API",
        summary="Backend API for the MedShelf medicine tracking MVP.",
        version="0.6.0",
        lifespan=lifespan,
    )
    app.state.settings = settings

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(medications.router)
    app.include_router(schedules.router)
    app.include_router(doses.router)
    app.include_router(leaflets.router)
    app.include_router(dashboard.router)
    app.include_router(restock.router)
    app.include_router(demo.router)

    @app.get("/api/health", tags=["system"])
    def health_check() -> dict[str, str]:
        return {
            "status": "ok",
            "service": "medshelf-api",
            "environment": settings.app_env,
        }

    @app.get("/", tags=["system"])
    def root() -> dict[str, str]:
        return {
            "message": "MedShelf API is running. See /docs for the API schema.",
        }

    return app


app = create_app()
