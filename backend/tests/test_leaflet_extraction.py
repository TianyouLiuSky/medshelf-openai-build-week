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


def test_browser_ocr_text_extraction_stores_text_and_needs_review(
    tmp_path, monkeypatch
) -> None:
    with configured_client(tmp_path, monkeypatch) as client:
        medication = create_test_medication(client)
        upload_response = client.post(
            f"/api/medications/{medication['id']}/leaflet",
            content=b"fake image bytes for browser OCR flow",
            headers={
                "Content-Type": "image/jpeg",
                "X-Leaflet-Filename": "leaflet-photo.jpg",
            },
        )
        assert upload_response.status_code == 201
        upload = upload_response.json()

        ocr_text = (
            "Medicine name:\nPhoto Relief Tablet\n\n"
            "Active ingredient:\nExample photo ingredient 5 mg.\n\n"
            "Directions:\nFollow the package label.\n\n"
            "Warnings:\nAsk a pharmacist if instructions conflict.\n"
        )
        response = client.post(
            f"/api/leaflets/{upload['id']}/extract/browser-ocr",
            json={"source_text": ocr_text},
        )

        assert response.status_code == 200
        extraction = response.json()
        assert extraction["provider"] == "browser_ocr"
        assert extraction["status"] == "needs_review"
        assert extraction["source_text"] == ocr_text.strip()
        assert extraction["parsed_output"]["needs_review"] is True
        assert extraction["parsed_output"]["medicine_name"]["value"] == (
            "Photo Relief Tablet"
        )

        uploads_response = client.get(
            f"/api/medications/{medication['id']}/leaflets"
        )
        assert uploads_response.status_code == 200
        assert uploads_response.json()[0]["status"] == "needs_review"


def test_browser_ocr_text_extraction_recognizes_chinese_leaflet_sections(
    tmp_path, monkeypatch
) -> None:
    with configured_client(tmp_path, monkeypatch) as client:
        medication = create_test_medication(client)
        upload_response = client.post(
            f"/api/medications/{medication['id']}/leaflet",
            content=b"fake image bytes for Chinese browser OCR flow",
            headers={
                "Content-Type": "image/heic",
                "X-Leaflet-Filename": "chinese-leaflet.heic",
            },
        )
        assert upload_response.status_code == 201
        upload = upload_response.json()

        ocr_text = (
            "【药品名称】通用名称：酚麻美敏片\n\n"
            "【成份】本品为复方制剂，每片含对乙酰氨基酚、盐酸伪麻黄碱等成份。\n\n"
            "【性状】本品为薄膜衣片。\n\n"
            "【用法用量】口服。成人一次1片，一日3次。请按说明书或医嘱使用。\n\n"
            "【不良反应】偶见轻度头晕、乏力、恶心、上腹不适、口干等。\n\n"
            "【禁忌】严重肝肾功能不全者禁用。\n\n"
            "【注意事项】用药3-7天，症状未缓解，请咨询医师或药师。\n\n"
            "【贮藏】密封，在阴凉干燥处保存。"
        )
        response = client.post(
            f"/api/leaflets/{upload['id']}/extract/browser-ocr",
            json={"source_text": ocr_text},
        )

        assert response.status_code == 200
        extraction = response.json()
        parsed = extraction["parsed_output"]
        assert extraction["provider"] == "browser_ocr"
        assert extraction["status"] == "needs_review"
        assert parsed["needs_review"] is True
        assert parsed["medicine_name"]["value"] == "酚麻美敏片"
        assert "对乙酰氨基酚" in parsed["active_ingredients"][0]["name"]
        assert "成人一次1片" in parsed["usage_instructions"][0]["instruction"]
        assert "头晕" in parsed["side_effects"][0]["text"]
        assert "严重肝肾功能不全者禁用" in parsed["contraindications"][0]["text"]
        assert "请咨询医师或药师" in parsed["warnings"][0]["warning"]
        assert "阴凉干燥处保存" in parsed["storage"][0]["text"]
        assert not any(
            "recognizable section headings" in note
            for note in parsed["review_notes"]
        )


def test_chinese_standard_heading_variants_do_not_bleed_between_sections(
    tmp_path, monkeypatch
) -> None:
    with configured_client(tmp_path, monkeypatch) as client:
        medication = create_test_medication(client)
        upload_response = client.post(
            f"/api/medications/{medication['id']}/leaflet",
            content=b"fake image bytes for Chinese standard heading variants",
            headers={
                "Content-Type": "image/png",
                "X-Leaflet-Filename": "standard-chinese-heading.png",
            },
        )
        assert upload_response.status_code == 201
        upload = upload_response.json()

        ocr_text = (
            "【药品名称】通用名称：示例中成药\n\n"
            "【处方组成】金银花、连翘、薄荷。\n\n"
            "【功能主治】用于风热感冒。\n\n"
            "【用法用量】口服，一次2片。\n\n"
            "【警示语】过敏体质者慎用。\n\n"
            "【孕妇及哺乳期妇女用药】孕妇应在医师指导下使用。\n\n"
            "【药物相互作用】如与其他药物同时使用可能发生相互作用。\n\n"
            "【禁忌证】对本品过敏者禁用。\n\n"
            "【不良反应】尚不明确。\n\n"
            "【贮藏方法】密封保存。\n\n"
            "--- Page 2: second-page.jpg ---\n\n"
            "【上市许可持有人】示例药业有限公司\n\n"
            "【批准文号】国药准字Z00000000"
        )
        response = client.post(
            f"/api/leaflets/{upload['id']}/extract/browser-ocr",
            json={"source_text": ocr_text},
        )

        assert response.status_code == 200
        parsed = response.json()["parsed_output"]
        warning_text = "\n".join(
            warning["warning"] for warning in parsed["warnings"]
        )
        assert parsed["medicine_name"]["value"] == "示例中成药"
        assert parsed["active_ingredients"][0]["name"] == "金银花、连翘、薄荷。"
        assert parsed["usage_instructions"][0]["instruction"] == "口服，一次2片。"
        assert "过敏体质者慎用" in warning_text
        assert "孕妇应在医师指导下使用" in warning_text
        assert "可能发生相互作用" in warning_text
        assert parsed["contraindications"][0]["text"] == "对本品过敏者禁用。"
        assert parsed["side_effects"][0]["text"] == "尚不明确。"
        assert parsed["storage"][0]["text"] == "密封保存。"
        assert "用于风热感冒" not in warning_text
        assert "Page 2" not in parsed["storage"][0]["text"]
        assert "示例药业" not in parsed["storage"][0]["text"]


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
