from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
import re
from uuid import uuid4


ALLOWED_EXTENSIONS = {
    ".bmp",
    ".gif",
    ".heic",
    ".heif",
    ".jpeg",
    ".jpg",
    ".pdf",
    ".png",
    ".tif",
    ".tiff",
    ".txt",
    ".webp",
    ".zip",
}
ALLOWED_CONTENT_TYPES = {
    "application/octet-stream",
    "application/pdf",
    "application/zip",
    "application/x-zip-compressed",
    "image/bmp",
    "image/gif",
    "image/heic",
    "image/heif",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/webp",
    "text/plain",
}
DEFAULT_CONTENT_TYPE = "application/octet-stream"


@dataclass(frozen=True)
class StoredLeafletFile:
    original_filename: str
    stored_filename: str
    source_file_path: str
    content_type: str
    size_bytes: int


class LeafletStorageError(ValueError):
    def __init__(self, message: str, status_code: int = 400) -> None:
        super().__init__(message)
        self.status_code = status_code


def resolve_upload_dir(upload_dir: str) -> Path:
    path = Path(upload_dir).expanduser()
    if not path.is_absolute():
        path = Path.cwd() / path
    return path.resolve()


def sanitize_filename(filename: str) -> str:
    normalized = Path(filename.strip()).name
    normalized = re.sub(r"[^A-Za-z0-9._-]+", "-", normalized).strip(".-")
    if not normalized:
        return "leaflet.txt"

    suffix = Path(normalized).suffix
    stem = Path(normalized).stem
    if suffix:
        return f"{stem[:100]}{suffix.lower()}"

    return normalized[:140]


def validate_leaflet_file(
    filename: str, content_type: str, file_bytes: bytes, max_upload_bytes: int
) -> tuple[str, str]:
    safe_filename = sanitize_filename(filename)
    suffix = Path(safe_filename).suffix.lower()
    normalized_content_type = content_type.split(";")[0].strip().lower()
    if not normalized_content_type:
        normalized_content_type = DEFAULT_CONTENT_TYPE

    if suffix not in ALLOWED_EXTENSIONS:
        allowed = ", ".join(sorted(ALLOWED_EXTENSIONS))
        raise LeafletStorageError(f"Leaflet file must use one of: {allowed}.")

    if normalized_content_type not in ALLOWED_CONTENT_TYPES:
        raise LeafletStorageError("Leaflet file type is not supported.")

    if not file_bytes:
        raise LeafletStorageError("Leaflet file cannot be empty.")

    if len(file_bytes) > max_upload_bytes:
        raise LeafletStorageError("Leaflet file is too large.", status_code=413)

    return safe_filename, normalized_content_type


def store_leaflet_file(
    upload_dir: str,
    original_filename: str,
    content_type: str,
    file_bytes: bytes,
    max_upload_bytes: int,
) -> StoredLeafletFile:
    safe_filename, normalized_content_type = validate_leaflet_file(
        original_filename, content_type, file_bytes, max_upload_bytes
    )
    upload_path = resolve_upload_dir(upload_dir)
    upload_path.mkdir(parents=True, exist_ok=True)

    suffix = Path(safe_filename).suffix.lower()
    stem = Path(safe_filename).stem[:80] or "leaflet"
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    stored_filename = f"{timestamp}-{uuid4().hex[:12]}-{stem}{suffix}"
    source_file_path = upload_path / stored_filename
    source_file_path.write_bytes(file_bytes)

    return StoredLeafletFile(
        original_filename=safe_filename,
        stored_filename=stored_filename,
        source_file_path=str(source_file_path),
        content_type=normalized_content_type,
        size_bytes=len(file_bytes),
    )
