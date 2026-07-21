from collections.abc import Iterator
from datetime import date

import pytest
from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.settings import get_settings


@pytest.fixture
def client(tmp_path, monkeypatch) -> Iterator[TestClient]:
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("SEED_DEMO_DATA", "false")
    get_settings.cache_clear()

    with TestClient(create_app()) as test_client:
        yield test_client

    get_settings.cache_clear()


def test_medication_response_includes_inventory_estimates(
    client: TestClient,
) -> None:
    medication_response = client.post(
        "/api/medications",
        json={
            "name": "Inventory Test Medicine",
            "form": "tablet",
            "strength": "5 mg",
            "quantity_remaining": 14,
            "quantity_unit": "tablets",
            "dose_amount": 2,
            "dose_unit": "tablets",
            "low_stock_threshold": 5,
        },
    )
    assert medication_response.status_code == 201
    medication = medication_response.json()

    schedule_response = client.post(
        f"/api/medications/{medication['id']}/schedules",
        json={
            "times": ["08:00"],
            "days_of_week": [0, 1, 2, 3, 4, 5, 6],
            "start_date": date.today().isoformat(),
        },
    )
    assert schedule_response.status_code == 201

    detail = client.get(f"/api/medications/{medication['id']}").json()
    assert detail["daily_usage_estimate"] == 2
    assert detail["days_remaining_estimate"] == 7


def test_inventory_estimates_are_null_without_schedule_or_dose(
    client: TestClient,
) -> None:
    medication_response = client.post(
        "/api/medications",
        json={
            "name": "No Schedule Medicine",
            "quantity_remaining": 14,
            "quantity_unit": "tablets",
            "dose_amount": 2,
            "dose_unit": "tablets",
        },
    )
    assert medication_response.status_code == 201

    detail = client.get(
        f"/api/medications/{medication_response.json()['id']}"
    ).json()
    assert detail["daily_usage_estimate"] is None
    assert detail["days_remaining_estimate"] is None


def test_non_routine_medicine_does_not_generate_schedule_estimates(
    client: TestClient,
) -> None:
    medication_response = client.post(
        "/api/medications",
        json={
            "name": "As Needed Medicine",
            "is_routine": False,
            "quantity_remaining": 12,
            "quantity_unit": "capsules",
            "dose_amount": 1,
            "dose_unit": "capsule",
            "low_stock_threshold": 15,
        },
    )
    assert medication_response.status_code == 201
    medication = medication_response.json()
    assert medication["is_routine"] is False
    assert medication["is_low_stock"] is True

    schedule_response = client.post(
        f"/api/medications/{medication['id']}/schedules",
        json={
            "times": ["08:00"],
            "days_of_week": [0, 1, 2, 3, 4, 5, 6],
            "start_date": date.today().isoformat(),
        },
    )
    assert schedule_response.status_code == 201

    detail = client.get(f"/api/medications/{medication['id']}").json()
    assert detail["daily_usage_estimate"] is None
    assert detail["days_remaining_estimate"] is None


def test_restock_suggestion_endpoint_returns_search_links(
    client: TestClient,
) -> None:
    medication_response = client.post(
        "/api/medications",
        json={
            "name": "Low Stock Search Medicine",
            "form": "tablet",
            "strength": "10 mg",
            "quantity_remaining": 3,
            "quantity_unit": "tablets",
            "dose_amount": 1,
            "dose_unit": "tablet",
            "low_stock_threshold": 5,
        },
    )
    assert medication_response.status_code == 201
    medication = medication_response.json()

    response = client.get(
        f"/api/restock/suggestions?medication_id={medication['id']}&region=Seattle"
    )

    assert response.status_code == 200
    suggestion = response.json()
    assert suggestion["medication_name"] == "Low Stock Search Medicine"
    assert suggestion["is_low_stock"] is True
    assert suggestion["search_query"] == (
        "Low Stock Search Medicine 10 mg tablet tablets pharmacy Seattle"
    )
    assert len(suggestion["links"]) == 3
    assert suggestion["links"][0]["url"].startswith(
        "https://www.google.com/search?q="
    )


def test_restock_suggestion_404_for_missing_medication(client: TestClient) -> None:
    response = client.get("/api/restock/suggestions?medication_id=999")

    assert response.status_code == 404
