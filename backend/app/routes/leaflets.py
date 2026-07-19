from urllib.parse import unquote

from fastapi import APIRouter, Header, HTTPException, Request, status

from ..repository import (
    create_leaflet_upload,
    get_medication,
    list_leaflet_uploads_for_medication,
)
from ..schemas import LeafletUploadRead
from ..services.leaflet_storage import LeafletStorageError, store_leaflet_file

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
