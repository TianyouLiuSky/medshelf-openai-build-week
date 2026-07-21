from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.settings import get_settings


@pytest.fixture
def client(tmp_path, monkeypatch) -> Iterator[TestClient]:
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("LEAFLET_UPLOAD_DIR", str(tmp_path / "uploads"))
    monkeypatch.setenv("SEED_DEMO_DATA", "false")
    get_settings.cache_clear()

    with TestClient(create_app()) as test_client:
        yield test_client

    get_settings.cache_clear()


def test_medication_crud(client: TestClient) -> None:
    assert client.get("/api/medications").json() == []

    create_response = client.post(
        "/api/medications",
        json={
            "name": "Test Medicine",
            "active_ingredients": "Ingredient",
            "form": "tablet",
            "strength": "10 mg",
            "quantity_remaining": 12,
            "quantity_unit": "tablets",
            "dose_amount": 1,
            "dose_unit": "tablet",
            "low_stock_threshold": 5,
            "notes": "User-entered test medicine.",
        },
    )

    assert create_response.status_code == 201
    created = create_response.json()
    assert created["id"] > 0
    assert created["name"] == "Test Medicine"
    assert created["is_routine"] is True
    assert created["is_low_stock"] is False

    medication_id = created["id"]
    detail_response = client.get(f"/api/medications/{medication_id}")
    assert detail_response.status_code == 200
    assert detail_response.json()["strength"] == "10 mg"

    update_response = client.patch(
        f"/api/medications/{medication_id}",
        json={"quantity_remaining": 4, "is_routine": False},
    )
    assert update_response.status_code == 200
    assert update_response.json()["is_low_stock"] is True
    assert update_response.json()["is_routine"] is False

    list_response = client.get("/api/medications")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    delete_response = client.delete(f"/api/medications/{medication_id}")
    assert delete_response.status_code == 204
    assert client.get(f"/api/medications/{medication_id}").status_code == 404


def test_demo_seed_route(client: TestClient) -> None:
    response = client.post("/api/demo/seed")

    assert response.status_code == 200
    medications = response.json()["medications"]
    assert len(medications) == 4
    assert any(medication["is_low_stock"] for medication in medications)

    medications_by_name = {
        medication["name"]: medication for medication in medications
    }
    reviewed = medications_by_name["Reviewed Leaflet Sample"]
    pending = medications_by_name["Pending Leaflet Sample"]

    reviewed_guidance = client.get(
        f"/api/medications/{reviewed['id']}/leaflet-guidance"
    )
    assert reviewed_guidance.status_code == 200
    assert len(reviewed_guidance.json()) == 1
    assert reviewed_guidance.json()[0]["guidance"]["needs_review"] is False

    pending_uploads = client.get(f"/api/medications/{pending['id']}/leaflets")
    assert pending_uploads.status_code == 200
    assert pending_uploads.json()[0]["status"] == "needs_review"

    repeat_response = client.post("/api/demo/seed")
    assert repeat_response.status_code == 200
    assert len(repeat_response.json()["medications"]) == 4
