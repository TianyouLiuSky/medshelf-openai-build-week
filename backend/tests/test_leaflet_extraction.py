from collections.abc import Iterator
from contextlib import contextmanager

from fastapi.testclient import TestClient

from backend.app.main import create_app
from backend.app.settings import get_settings


@contextmanager
def configured_client(
    tmp_path, monkeypatch, **environment: str
) -> Iterator[TestClient]:
    monkeypatch.setenv("DATABASE_URL", f"sqlite:///{tmp_path / 'test.db'}")
    monkeypatch.setenv("LEAFLET_UPLOAD_DIR", str(tmp_path / "uploads"))
    monkeypatch.setenv("SEED_DEMO_DATA", "false")
    for key, value in environment.items():
        monkeypatch.setenv(key, value)
    get_settings.cache_clear()

    with TestClient(create_app()) as test_client:
        yield test_client

    get_settings.cache_clear()


def create_test_medication(client: TestClient) -> dict:
    response = client.post(
        "/api/medications",
        json={
            "name": "Leaflet Extraction Medicine",
            "quantity_remaining": 8,
            "quantity_unit": "tablets",
        },
    )
    assert response.status_code == 201
    return response.json()


def upload_text_leaflet(client: TestClient, medication_id: int) -> dict:
    response = client.post(
        f"/api/medications/{medication_id}/leaflet",
        content=(
            b"Medicine name:\nSample Relief Tablet\n\n"
            b"Active ingredient:\nExample active ingredient 10 mg.\n\n"
            b"Directions:\nFollow the directions on the package label.\n\n"
            b"Warnings:\nAsk a clinician or pharmacist if plans conflict.\n\n"
            b"Storage:\nStore in a cool, dry place."
        ),
        headers={
            "Content-Type": "text/plain",
            "X-Leaflet-Filename": "sample-leaflet.txt",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_mock_extraction_returns_needs_review_and_updates_upload_status(
    tmp_path, monkeypatch
) -> None:
    with configured_client(tmp_path, monkeypatch) as client:
        medication = create_test_medication(client)
        upload = upload_text_leaflet(client, medication["id"])

        response = client.post(f"/api/leaflets/{upload['id']}/extract")

        assert response.status_code == 200
        extraction = response.json()
        assert extraction["provider"] == "mock"
        assert extraction["status"] == "needs_review"
        assert extraction["parsed_output"]["needs_review"] is True
        assert extraction["parsed_output"]["medicine_name"]["value"] == (
            "Sample Relief Tablet"
        )
        assert "source_file_path" not in extraction
        assert extraction["raw_model_output"]

        uploads_response = client.get(
            f"/api/medications/{medication['id']}/leaflets"
        )
        assert uploads_response.status_code == 200
        assert uploads_response.json()[0]["status"] == "needs_review"


def test_local_ocr_provider_reads_text_leaflet(tmp_path, monkeypatch) -> None:
    with configured_client(
        tmp_path, monkeypatch, EXTRACTION_PROVIDER="local_ocr"
    ) as client:
        medication = create_test_medication(client)
        upload = upload_text_leaflet(client, medication["id"])

        response = client.post(f"/api/leaflets/{upload['id']}/extract")

        assert response.status_code == 200
        extraction = response.json()
        assert extraction["provider"] == "local_ocr"
        assert extraction["status"] == "needs_review"
        assert extraction["source_text"].startswith("Medicine name:")
        assert extraction["parsed_output"]["needs_review"] is True


def test_failed_extraction_records_failed_status(tmp_path, monkeypatch) -> None:
    with configured_client(
        tmp_path,
        monkeypatch,
        EXTRACTION_PROVIDER="local_ocr",
        LOCAL_OCR_COMMAND="missing-ocr-command-for-test",
    ) as client:
        medication = create_test_medication(client)
        upload_response = client.post(
            f"/api/medications/{medication['id']}/leaflet",
            content=b"not a real image but enough for storage",
            headers={
                "Content-Type": "image/png",
                "X-Leaflet-Filename": "leaflet.png",
            },
        )
        assert upload_response.status_code == 201
        upload = upload_response.json()

        response = client.post(f"/api/leaflets/{upload['id']}/extract")

        assert response.status_code == 200
        extraction = response.json()
        assert extraction["status"] == "failed"
        assert extraction["provider"] == "local_ocr"
        assert "was not found" in extraction["error_message"]
        assert extraction["parsed_output"] is None

        uploads_response = client.get(
            f"/api/medications/{medication['id']}/leaflets"
        )
        assert uploads_response.status_code == 200
        assert uploads_response.json()[0]["status"] == "failed"


def test_extract_404_for_missing_leaflet(tmp_path, monkeypatch) -> None:
    with configured_client(tmp_path, monkeypatch) as client:
        response = client.post("/api/leaflets/999/extract")

        assert response.status_code == 404


def test_extract_rejects_unknown_provider(tmp_path, monkeypatch) -> None:
    with configured_client(tmp_path, monkeypatch) as client:
        medication = create_test_medication(client)
        upload = upload_text_leaflet(client, medication["id"])

        response = client.post(
            f"/api/leaflets/{upload['id']}/extract?provider=nope"
        )

        assert response.status_code == 400
        uploads_response = client.get(
            f"/api/medications/{medication['id']}/leaflets"
        )
        assert uploads_response.status_code == 200
        assert uploads_response.json()[0]["status"] == "uploaded"


def test_approve_leaflet_extraction_saves_reviewed_guidance(
    tmp_path, monkeypatch
) -> None:
    with configured_client(tmp_path, monkeypatch) as client:
        medication = create_test_medication(client)
        upload = upload_text_leaflet(client, medication["id"])
        extraction_response = client.post(f"/api/leaflets/{upload['id']}/extract")
        assert extraction_response.status_code == 200
        extraction = extraction_response.json()
        reviewed = extraction["parsed_output"]
        reviewed.pop("needs_review")
        reviewed["medicine_name"]["value"] = "Reviewed Relief Tablet"
        reviewed["plain_language_summary"] = "Reviewed summary for the demo."
        reviewed["warnings"] = []

        approve_response = client.post(
            f"/api/leaflets/{upload['id']}/approve",
            json={"extraction_id": extraction["id"], **reviewed},
        )

        assert approve_response.status_code == 200
        guidance = approve_response.json()
        assert guidance["medication_id"] == medication["id"]
        assert guidance["leaflet_upload_id"] == upload["id"]
        assert guidance["leaflet_extraction_id"] == extraction["id"]
        assert guidance["guidance"]["needs_review"] is False
        assert guidance["guidance"]["medicine_name"]["value"] == (
            "Reviewed Relief Tablet"
        )
        assert guidance["guidance"]["warnings"] == []

        guidance_response = client.get(
            f"/api/medications/{medication['id']}/leaflet-guidance"
        )
        assert guidance_response.status_code == 200
        assert guidance_response.json()[0]["id"] == guidance["id"]

        uploads_response = client.get(
            f"/api/medications/{medication['id']}/leaflets"
        )
        assert uploads_response.status_code == 200
        assert uploads_response.json()[0]["status"] == "approved"

        latest_response = client.get(f"/api/leaflets/{upload['id']}/extraction")
        assert latest_response.status_code == 200
        assert latest_response.json()["status"] == "approved"


def test_approve_rejects_non_review_extraction(tmp_path, monkeypatch) -> None:
    with configured_client(tmp_path, monkeypatch) as client:
        medication = create_test_medication(client)
        upload = upload_text_leaflet(client, medication["id"])
        extraction_response = client.post(f"/api/leaflets/{upload['id']}/extract")
        assert extraction_response.status_code == 200
        extraction = extraction_response.json()
        reviewed = extraction["parsed_output"]
        reviewed.pop("needs_review")

        first_response = client.post(
            f"/api/leaflets/{upload['id']}/approve",
            json={"extraction_id": extraction["id"], **reviewed},
        )
        assert first_response.status_code == 200

        second_response = client.post(
            f"/api/leaflets/{upload['id']}/approve",
            json={"extraction_id": extraction["id"], **reviewed},
        )

        assert second_response.status_code == 400
