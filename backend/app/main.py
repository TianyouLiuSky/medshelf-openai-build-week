from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from .database import init_db
from .repository import seed_demo_medications
from .routes import dashboard, demo, doses, leaflets, medications, restock, schedules
from .settings import get_settings


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = app.state.settings
    init_db(settings.database_url)
    if settings.seed_demo_data:
        seed_demo_medications(
            settings.database_url,
            reset=settings.reset_demo_data_on_start,
            leaflet_upload_dir=settings.leaflet_upload_dir,
        )
    yield


def resolve_frontend_dist_dir(frontend_dist_dir: str) -> Path | None:
    dist_path = Path(frontend_dist_dir)
    if not dist_path.is_absolute():
        dist_path = Path.cwd() / dist_path
    dist_path = dist_path.resolve()
    if (dist_path / "index.html").is_file():
        return dist_path
    return None


def mount_frontend(app: FastAPI, dist_path: Path) -> None:
    assets_path = dist_path / "assets"
    if assets_path.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_path), name="frontend-assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def serve_frontend(full_path: str) -> FileResponse:
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")

        requested_path = (dist_path / full_path).resolve()
        if requested_path.is_file() and requested_path.is_relative_to(dist_path):
            return FileResponse(requested_path)

        return FileResponse(dist_path / "index.html")


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title="MedShelf API",
        summary="Backend API for the MedShelf medicine tracking MVP.",
        version="0.8.0",
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
    frontend_dist_dir = resolve_frontend_dist_dir(settings.frontend_dist_dir)

    @app.get("/api/health", tags=["system"])
    def health_check() -> dict[str, str]:
        return {
            "status": "ok",
            "service": "medshelf-api",
            "environment": settings.app_env,
        }

    @app.get("/api/config", tags=["system"])
    def client_config() -> dict[str, bool]:
        return {"public_demo": settings.public_demo}

    if frontend_dist_dir is None:
        @app.get("/", tags=["system"])
        def root() -> dict[str, str]:
            return {
                "message": "MedShelf API is running. See /docs for the API schema.",
            }
    else:
        mount_frontend(app, frontend_dist_dir)

    return app


app = create_app()
