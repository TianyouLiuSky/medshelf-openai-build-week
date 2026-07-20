from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.settings import get_settings


def test_settings_load_root_env_file(tmp_path, monkeypatch) -> None:
    monkeypatch.chdir(tmp_path)
    monkeypatch.delenv("APP_ENV", raising=False)
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("SEED_DEMO_DATA", raising=False)
    (tmp_path / ".env").write_text(
        "\n".join(
            [
                "APP_ENV=demo",
                "DATABASE_URL=sqlite:///./demo-readiness.db",
                "SEED_DEMO_DATA=false",
            ]
        ),
        encoding="utf-8",
    )

    get_settings.cache_clear()
    settings = get_settings()

    assert settings.app_env == "demo"
    assert settings.database_url == "sqlite:///./demo-readiness.db"
    assert settings.seed_demo_data is False

    get_settings.cache_clear()


def test_health_check(tmp_path, monkeypatch) -> None:
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("SEED_DEMO_DATA", "false")
    get_settings.cache_clear()

    with TestClient(create_app()) as client:
        response = client.get("/api/health")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "medshelf-api",
        "environment": "development",
    }

    get_settings.cache_clear()


def test_serves_built_frontend_when_dist_exists(tmp_path, monkeypatch) -> None:
    dist_dir = tmp_path / "frontend-dist"
    assets_dir = dist_dir / "assets"
    assets_dir.mkdir(parents=True)
    (dist_dir / "index.html").write_text("<main>MedShelf app</main>", encoding="utf-8")
    (assets_dir / "app.js").write_text("console.log('medshelf')", encoding="utf-8")

    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("SEED_DEMO_DATA", "false")
    monkeypatch.setenv("FRONTEND_DIST_DIR", str(dist_dir))
    get_settings.cache_clear()

    with TestClient(create_app()) as client:
        root_response = client.get("/")
        deep_link_response = client.get("/medications/1")
        asset_response = client.get("/assets/app.js")
        missing_api_response = client.get("/api/not-real")

    assert root_response.status_code == 200
    assert "MedShelf app" in root_response.text
    assert deep_link_response.status_code == 200
    assert "MedShelf app" in deep_link_response.text
    assert asset_response.status_code == 200
    assert "medshelf" in asset_response.text
    assert missing_api_response.status_code == 404

    get_settings.cache_clear()
