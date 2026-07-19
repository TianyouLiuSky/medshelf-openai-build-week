from collections.abc import Iterator
from datetime import date, timedelta

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


def create_test_medication(
    client: TestClient, quantity_remaining: float = 10, dose_amount: float = 2
) -> dict:
    response = client.post(
        "/api/medications",
        json={
            "name": "Scheduled Test Medicine",
            "quantity_remaining": quantity_remaining,
            "quantity_unit": "tablets",
            "dose_amount": dose_amount,
            "dose_unit": "tablets",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_schedule_crud_and_daily_generation(client: TestClient) -> None:
    medication = create_test_medication(client)
    dashboard_date = date.today() + timedelta(days=1)

    create_response = client.post(
        f"/api/medications/{medication['id']}/schedules",
        json={
            "times": ["08:00", "20:00"],
            "days_of_week": [dashboard_date.weekday()],
            "start_date": dashboard_date.isoformat(),
            "end_date": None,
        },
    )
    assert create_response.status_code == 201
    schedule = create_response.json()
    assert schedule["times"] == ["08:00", "20:00"]

    list_response = client.get(f"/api/medications/{medication['id']}/schedules")
    assert list_response.status_code == 200
    assert len(list_response.json()) == 1

    dashboard_response = client.get(
        f"/api/dashboard/today?date={dashboard_date.isoformat()}"
    )
    assert dashboard_response.status_code == 200
    doses = dashboard_response.json()["doses"]
    assert [dose["status"] for dose in doses] == ["due", "due"]

    update_response = client.patch(
        f"/api/schedules/{schedule['id']}",
        json={"times": ["09:30"]},
    )
    assert update_response.status_code == 200
    assert update_response.json()["times"] == ["09:30"]

    delete_response = client.delete(f"/api/schedules/{schedule['id']}")
    assert delete_response.status_code == 204
    assert client.get(f"/api/medications/{medication['id']}/schedules").json() == []


def test_dose_actions_update_status_and_inventory(client: TestClient) -> None:
    medication = create_test_medication(client)
    dashboard_date = date.today() - timedelta(days=1)

    schedule_response = client.post(
        f"/api/medications/{medication['id']}/schedules",
        json={
            "times": ["08:00"],
            "days_of_week": [dashboard_date.weekday()],
            "start_date": dashboard_date.isoformat(),
        },
    )
    assert schedule_response.status_code == 201

    dashboard_response = client.get(
        f"/api/dashboard/today?date={dashboard_date.isoformat()}"
    )
    dose = dashboard_response.json()["doses"][0]
    assert dose["status"] == "missed"

    taken_response = client.post(
        f"/api/medications/{medication['id']}/doses",
        json={
            "schedule_id": dose["schedule_id"],
            "scheduled_at": dose["scheduled_at"],
            "status": "taken",
        },
    )
    assert taken_response.status_code == 201
    assert taken_response.json()["quantity_delta"] == -2
    assert client.get(f"/api/medications/{medication['id']}").json()[
        "quantity_remaining"
    ] == 8

    skipped_response = client.post(
        f"/api/medications/{medication['id']}/doses",
        json={
            "schedule_id": dose["schedule_id"],
            "scheduled_at": dose["scheduled_at"],
            "status": "skipped",
        },
    )
    assert skipped_response.status_code == 201
    assert skipped_response.json()["quantity_delta"] == 0
    assert client.get(f"/api/medications/{medication['id']}").json()[
        "quantity_remaining"
    ] == 10

    updated_dashboard = client.get(
        f"/api/dashboard/today?date={dashboard_date.isoformat()}"
    ).json()
    assert updated_dashboard["doses"][0]["status"] == "skipped"


def test_dose_action_restores_only_applied_inventory_delta(
    client: TestClient,
) -> None:
    medication = create_test_medication(
        client, quantity_remaining=1, dose_amount=2
    )
    dashboard_date = date.today() - timedelta(days=1)

    schedule_response = client.post(
        f"/api/medications/{medication['id']}/schedules",
        json={
            "times": ["08:00"],
            "days_of_week": [dashboard_date.weekday()],
            "start_date": dashboard_date.isoformat(),
        },
    )
    assert schedule_response.status_code == 201

    dose = client.get(
        f"/api/dashboard/today?date={dashboard_date.isoformat()}"
    ).json()["doses"][0]

    taken_response = client.post(
        f"/api/medications/{medication['id']}/doses",
        json={
            "schedule_id": dose["schedule_id"],
            "scheduled_at": dose["scheduled_at"],
            "status": "taken",
        },
    )
    assert taken_response.status_code == 201
    assert taken_response.json()["quantity_delta"] == -1
    assert client.get(f"/api/medications/{medication['id']}").json()[
        "quantity_remaining"
    ] == 0

    skipped_response = client.post(
        f"/api/medications/{medication['id']}/doses",
        json={
            "schedule_id": dose["schedule_id"],
            "scheduled_at": dose["scheduled_at"],
            "status": "skipped",
        },
    )
    assert skipped_response.status_code == 201
    assert skipped_response.json()["quantity_delta"] == 0
    assert client.get(f"/api/medications/{medication['id']}").json()[
        "quantity_remaining"
    ] == 1
