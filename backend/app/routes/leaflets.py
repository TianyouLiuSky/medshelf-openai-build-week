import json
from pathlib import Path
from urllib.parse import unquote

from fastapi import APIRouter, Header, HTTPException, Request, status
from fastapi.responses import FileResponse

from ..repository import (
    approve_leaflet_guidance,
    complete_leaflet_extraction,
    create_leaflet_extraction_attempt,
    create_leaflet_upload,
    get_latest_leaflet_extraction_for_upload,
    get_medication,
    get_leaflet_upload,
    list_leaflet_guidance_for_medication,
    list_leaflet_uploads_for_medication,
)
from ..schemas import (
    LeafletBrowserOcrExtractRequest,
    LeafletApprovedGuidance,
    LeafletExtractionRead,
    LeafletGuidanceApproveRequest,
    LeafletGuidanceRead,
    LeafletUploadRead,
)
from ..services.ai_extraction import (
    ExtractionProviderError,
    SUPPORTED_PROVIDERS,
    browser_ocr_text_provider,
    model_to_dict,
    run_extraction_provider,
)
from ..services.leaflet_storage import (
    LeafletStorageError,
    resolve_upload_dir,
    store_leaflet_file,
)

router = APIRouter(tags=["leaflets"])


def database_url_from_request(request: Request) -> str:
    return request.app.state.settings.database_url


@router.get(
    "/api/medications/{medication_id}/leaflets",
    response_model=list[LeafletUploadRead],
)
def read_leaflet_uploads(request: Request, medication_id: int) -> list[dict]:
    uploads = list_leaflet_uploads_for_medication(
        database_url_from_request(request), medication_id
    )
    if uploads is None:
        raise HTTPException(status_code=404, detail="Medication not found.")
    return uploads


@router.get(
    "/api/medications/{medication_id}/leaflet-guidance",
    response_model=list[LeafletGuidanceRead],
)
def read_leaflet_guidance(request: Request, medication_id: int) -> list[dict]:
    guidance = list_leaflet_guidance_for_medication(
        database_url_from_request(request), medication_id
    )
    if guidance is None:
        raise HTTPException(status_code=404, detail="Medication not found.")
    return guidance


@router.post(
    "/api/medications/{medication_id}/leaflet",
    response_model=LeafletUploadRead,
    status_code=status.HTTP_201_CREATED,
)
async def upload_leaflet(
    request: Request,
    medication_id: int,
    x_leaflet_filename: str = Header("", alias="X-Leaflet-Filename"),
    content_type: str = Header("", alias="Content-Type"),
) -> dict:
    database_url = database_url_from_request(request)
    if get_medication(database_url, medication_id) is None:
        raise HTTPException(status_code=404, detail="Medication not found.")

    file_bytes = await request.body()
    filename = unquote(x_leaflet_filename).strip()
    if not filename:
        raise HTTPException(status_code=400, detail="Leaflet filename is required.")

    settings = request.app.state.settings
    try:
        stored_file = store_leaflet_file(
            settings.leaflet_upload_dir,
            filename,
            content_type,
            file_bytes,
            settings.leaflet_max_upload_bytes,
        )
    except LeafletStorageError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc

    upload = create_leaflet_upload(
        database_url,
        medication_id=medication_id,
        original_filename=stored_file.original_filename,
        stored_filename=stored_file.stored_filename,
        source_file_path=stored_file.source_file_path,
        content_type=stored_file.content_type,
        size_bytes=stored_file.size_bytes,
        status="uploaded",
    )
    if upload is None:
        raise HTTPException(status_code=404, detail="Medication not found.")

    return upload


@router.get(
    "/api/leaflets/{leaflet_id}/extraction",
    response_model=LeafletExtractionRead,
)
def read_latest_leaflet_extraction(request: Request, leaflet_id: int) -> dict:
    database_url = database_url_from_request(request)
    if get_leaflet_upload(database_url, leaflet_id) is None:
        raise HTTPException(status_code=404, detail="Leaflet upload not found.")

    extraction = get_latest_leaflet_extraction_for_upload(database_url, leaflet_id)
    if extraction is None:
        raise HTTPException(status_code=404, detail="Leaflet extraction not found.")

    return extraction


@router.get("/api/leaflets/{leaflet_id}/file")
def read_leaflet_file(request: Request, leaflet_id: int) -> FileResponse:
    database_url = database_url_from_request(request)
    upload = get_leaflet_upload(database_url, leaflet_id)
    if upload is None:
        raise HTTPException(status_code=404, detail="Leaflet upload not found.")

    settings = request.app.state.settings
    upload_root = resolve_upload_dir(settings.leaflet_upload_dir)
    source_file_path = Path(str(upload["source_file_path"])).expanduser().resolve()
    if not source_file_path.is_relative_to(upload_root):
        raise HTTPException(status_code=404, detail="Leaflet file not found.")

    if not source_file_path.is_file():
        raise HTTPException(status_code=404, detail="Leaflet file not found.")

    return FileResponse(
        source_file_path,
        media_type=str(upload["content_type"]),
        filename=str(upload["original_filename"]),
        headers={"Cache-Control": "private, no-store"},
    )


@router.post(
    "/api/leaflets/{leaflet_id}/extract",
    response_model=LeafletExtractionRead,
)
def extract_leaflet(
    request: Request, leaflet_id: int, provider: str = ""
) -> dict:
    database_url = database_url_from_request(request)
    upload = get_leaflet_upload(database_url, leaflet_id)
    if upload is None:
        raise HTTPException(status_code=404, detail="Leaflet upload not found.")

    settings = request.app.state.settings
    selected_provider = (provider or settings.extraction_provider).strip().lower()
    if selected_provider not in SUPPORTED_PROVIDERS:
        supported = ", ".join(sorted(SUPPORTED_PROVIDERS))
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported extraction provider. Use one of: {supported}.",
        )

    attempt = create_leaflet_extraction_attempt(
        database_url, upload, selected_provider
    )
    try:
        extraction = run_extraction_provider(upload, settings, selected_provider)
    except ExtractionProviderError as exc:
        failed = complete_leaflet_extraction(
            database_url,
            attempt["id"],
            status="failed",
            source_text="",
            raw_model_output=json.dumps(
                {
                    "provider": selected_provider,
                    "status": "failed",
                    "error": str(exc),
                },
                ensure_ascii=False,
            ),
            parsed_output=None,
            error_message=str(exc),
        )
        if failed is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Leaflet extraction attempt could not be updated.",
            )
        return failed

    completed = complete_leaflet_extraction(
        database_url,
        attempt["id"],
        status="needs_review",
        source_text=extraction.source_text,
        raw_model_output=extraction.raw_model_output,
        parsed_output=model_to_dict(extraction.parsed_output),
        error_message="",
    )
    if completed is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Leaflet extraction attempt could not be updated.",
        )

    return completed


@router.post(
    "/api/leaflets/{leaflet_id}/extract/browser-ocr",
    response_model=LeafletExtractionRead,
)
def extract_leaflet_from_browser_ocr(
    request: Request,
    leaflet_id: int,
    ocr_input: LeafletBrowserOcrExtractRequest,
) -> dict:
    database_url = database_url_from_request(request)
    upload = get_leaflet_upload(database_url, leaflet_id)
    if upload is None:
        raise HTTPException(status_code=404, detail="Leaflet upload not found.")

    attempt = create_leaflet_extraction_attempt(
        database_url, upload, "browser_ocr"
    )
    try:
        extraction = browser_ocr_text_provider(upload, ocr_input.source_text)
    except ExtractionProviderError as exc:
        failed = complete_leaflet_extraction(
            database_url,
            attempt["id"],
            status="failed",
            source_text=ocr_input.source_text,
            raw_model_output=json.dumps(
                {
                    "provider": "browser_ocr",
                    "status": "failed",
                    "error": str(exc),
                },
                ensure_ascii=False,
            ),
            parsed_output=None,
            error_message=str(exc),
        )
        if failed is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Leaflet extraction attempt could not be updated.",
            )
        return failed

    completed = complete_leaflet_extraction(
        database_url,
        attempt["id"],
        status="needs_review",
        source_text=extraction.source_text,
        raw_model_output=extraction.raw_model_output,
        parsed_output=model_to_dict(extraction.parsed_output),
        error_message="",
    )
    if completed is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Leaflet extraction attempt could not be updated.",
        )

    return completed


@router.post(
    "/api/leaflets/{leaflet_id}/approve",
    response_model=LeafletGuidanceRead,
)
def approve_leaflet(
    request: Request,
    leaflet_id: int,
    review: LeafletGuidanceApproveRequest,
) -> dict:
    database_url = database_url_from_request(request)
    if get_leaflet_upload(database_url, leaflet_id) is None:
        raise HTTPException(status_code=404, detail="Leaflet upload not found.")

    if hasattr(review, "model_dump"):
        review_data = review.model_dump(exclude={"extraction_id"})
    else:
        review_data = review.dict(exclude={"extraction_id"})
    approved_guidance = LeafletApprovedGuidance(**review_data)

    try:
        guidance = approve_leaflet_guidance(
            database_url,
            leaflet_id,
            review.extraction_id,
            model_to_dict(approved_guidance),
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    if guidance is None:
        raise HTTPException(status_code=404, detail="Leaflet extraction not found.")

    return guidance
