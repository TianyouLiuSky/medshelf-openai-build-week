from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.settings import get_settings


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
