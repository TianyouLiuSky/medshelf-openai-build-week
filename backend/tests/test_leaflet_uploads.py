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


def create_test_medication(client: TestClient) -> dict:
    response = client.post(
        "/api/medications",
        json={
            "name": "Leaflet Upload Medicine",
            "quantity_remaining": 8,
            "quantity_unit": "tablets",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_leaflet_upload_stores_file_and_status(
    client: TestClient, tmp_path
) -> None:
    medication = create_test_medication(client)

    upload_response = client.post(
        f"/api/medications/{medication['id']}/leaflet",
        content=b"Sample leaflet text for upload smoke testing.",
        headers={
            "Content-Type": "text/plain",
            "X-Leaflet-Filename": "sample-leaflet.txt",
        },
    )

    assert upload_response.status_code == 201
    upload = upload_response.json()
    assert upload["medication_id"] == medication["id"]
    assert upload["original_filename"] == "sample-leaflet.txt"
    assert upload["content_type"] == "text/plain"
    assert upload["size_bytes"] > 0
    assert upload["status"] == "uploaded"
    assert "source_file_path" not in upload
    assert (tmp_path / "uploads" / upload["stored_filename"]).exists()

    list_response = client.get(f"/api/medications/{medication['id']}/leaflets")
    assert list_response.status_code == 200
    assert [item["id"] for item in list_response.json()] == [upload["id"]]


def test_leaflet_upload_rejects_missing_medication(client: TestClient) -> None:
    response = client.post(
        "/api/medications/999/leaflet",
        content=b"Sample leaflet text.",
        headers={
            "Content-Type": "text/plain",
            "X-Leaflet-Filename": "sample-leaflet.txt",
        },
    )

    assert response.status_code == 404


def test_leaflet_upload_rejects_unsupported_file_type(
    client: TestClient,
) -> None:
    medication = create_test_medication(client)

    response = client.post(
        f"/api/medications/{medication['id']}/leaflet",
        content=b"Not a supported leaflet fixture.",
        headers={
            "Content-Type": "application/octet-stream",
            "X-Leaflet-Filename": "sample.exe",
        },
    )

    assert response.status_code == 400


def test_leaflet_list_404_for_missing_medication(client: TestClient) -> None:
    response = client.get("/api/medications/999/leaflets")

    assert response.status_code == 404
