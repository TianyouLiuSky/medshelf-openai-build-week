from __future__ import annotations

from base64 import b64encode
from dataclasses import dataclass
import json
from pathlib import Path
import re
import subprocess
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from pydantic import ValidationError

from ..schemas import LeafletParsedOutput
from ..settings import Settings


SUPPORTED_PROVIDERS = {"mock", "local_ocr", "openai"}
TEXT_CONTENT_TYPES = {"text/plain"}
IMAGE_CONTENT_TYPES = {"image/gif", "image/jpeg", "image/png", "image/webp"}
SUFFIX_CONTENT_TYPES = {
    ".gif": "image/gif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".txt": "text/plain",
    ".webp": "image/webp",
}
OPENAI_TIMEOUT_SECONDS = 60
SOURCE_TEXT_LIMIT = 60000

SECTION_HEADINGS = {
    "medicine_name": {"medicine name", "name"},
    "active_ingredients": {"active ingredient", "active ingredients"},
    "usage_instructions": {"directions", "usage", "instructions", "how to use"},
    "warnings": {"warning", "warnings"},
    "contraindications": {"contraindication", "contraindications", "do not use"},
    "side_effects": {"side effect", "side effects", "possible side effects"},
    "storage": {"storage", "how to store"},
}
ALL_HEADINGS = {
    heading for headings in SECTION_HEADINGS.values() for heading in headings
}

PROMPT_GUARDRAILS = """You are extracting information from medicine packaging or a patient leaflet.
Only use information visible in the provided input.
Do not infer missing dosage, warnings, contraindications, or side effects from general knowledge.
Preserve short source snippets for every extracted claim.
If text is unclear, mark confidence as low and add a review note.
Return valid JSON matching the requested schema.
Set needs_review to true.
This output is for user review and is not medical advice."""


class ExtractionProviderError(RuntimeError):
    pass


@dataclass(frozen=True)
class ExtractionResult:
    provider: str
    source_text: str
    raw_model_output: str
    parsed_output: LeafletParsedOutput


def model_to_dict(model: LeafletParsedOutput) -> dict[str, Any]:
    if hasattr(model, "model_dump"):
        return model.model_dump()
    return model.dict()


def model_json_schema(model: type[LeafletParsedOutput]) -> dict[str, Any]:
    if hasattr(model, "model_json_schema"):
        return model.model_json_schema()
    return model.schema()


def validate_parsed_output(payload: dict[str, Any]) -> LeafletParsedOutput:
    try:
        if hasattr(LeafletParsedOutput, "model_validate"):
            return LeafletParsedOutput.model_validate(payload)
        return LeafletParsedOutput.parse_obj(payload)
    except ValidationError as exc:
        raise ExtractionProviderError(
            "Extraction output did not match the required schema."
        ) from exc


def run_extraction_provider(
    leaflet_upload: dict[str, Any],
    settings: Settings,
    provider_override: str | None = None,
) -> ExtractionResult:
    provider = (provider_override or settings.extraction_provider).strip().lower()
    if provider not in SUPPORTED_PROVIDERS:
        supported = ", ".join(sorted(SUPPORTED_PROVIDERS))
        raise ValueError(f"Unsupported extraction provider. Use one of: {supported}.")

    if provider == "mock":
        return mock_provider(leaflet_upload)
    if provider == "local_ocr":
        return local_ocr_provider(leaflet_upload, settings)
    return openai_provider(leaflet_upload, settings)


def read_uploaded_text(leaflet_upload: dict[str, Any]) -> str:
    path = Path(str(leaflet_upload["source_file_path"]))
    content_type = infer_content_type(leaflet_upload, path)
    if content_type not in TEXT_CONTENT_TYPES and path.suffix.lower() != ".txt":
        return ""

    try:
        file_bytes = path.read_bytes()
    except OSError as exc:
        raise ExtractionProviderError("Uploaded leaflet file could not be read.") from exc

    try:
        return file_bytes.decode("utf-8")[:SOURCE_TEXT_LIMIT]
    except UnicodeDecodeError:
        return file_bytes.decode("utf-8", errors="replace")[:SOURCE_TEXT_LIMIT]


def normalize_heading(line: str) -> str:
    return re.sub(r"\s+", " ", line.strip().rstrip(":")).lower()


def extract_sections(text: str) -> dict[str, str]:
    sections: dict[str, list[str]] = {}
    current_key = ""

    for line in text.splitlines():
        heading = normalize_heading(line)
        matched_key = next(
            (
                key
                for key, headings in SECTION_HEADINGS.items()
                if heading in headings
            ),
            "",
        )
        if matched_key:
            current_key = matched_key
            sections.setdefault(current_key, [])
            continue

        if current_key and heading not in ALL_HEADINGS:
            sections[current_key].append(line.strip())

    return {
        key: collapse_whitespace("\n".join(lines))
        for key, lines in sections.items()
        if collapse_whitespace("\n".join(lines))
    }


def collapse_whitespace(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def snippet(value: str, limit: int = 500) -> str:
    clean = collapse_whitespace(value)
    if len(clean) <= limit:
        return clean
    return f"{clean[: limit - 3].rstrip()}..."


def split_claims(section_text: str) -> list[str]:
    if not section_text:
        return []

    lines = [collapse_whitespace(line) for line in section_text.splitlines()]
    claims = [line for line in lines if line]
    if claims:
        return claims

    return [snippet(section_text)]


def warning_severity(warning: str) -> str:
    normalized = warning.lower()
    if any(term in normalized for term in ("emergency", "severe", "allergic")):
        return "urgent"
    if any(term in normalized for term in ("do not", "ask", "warning", "avoid")):
        return "caution"
    return "info"


def heuristic_parse(
    source_text: str, original_filename: str, provider: str
) -> LeafletParsedOutput:
    sections = extract_sections(source_text)
    medicine_name = sections.get("medicine_name", "")
    active_ingredients = split_claims(sections.get("active_ingredients", ""))
    usage_instructions = split_claims(sections.get("usage_instructions", ""))
    warnings = split_claims(sections.get("warnings", ""))
    contraindications = split_claims(sections.get("contraindications", ""))
    side_effects = split_claims(sections.get("side_effects", ""))
    storage = split_claims(sections.get("storage", ""))
    review_notes = [
        f"Draft extraction generated by the {provider} provider.",
        "Review every field against the original leaflet before saving guidance.",
    ]

    if not source_text.strip():
        review_notes.append("No readable leaflet text was available.")
    elif not any(sections.values()):
        review_notes.append(
            "The text did not contain recognizable section headings; extraction is limited."
        )

    plain_summary = (
        f"Draft extraction from {original_filename}. Review the original leaflet "
        "and clinician or pharmacist directions before using these notes."
    )
    translated_summary = (
        "No translation was performed. Translation should remain reviewable before "
        "it is saved as guidance."
    )

    parsed = {
        "medicine_name": {
            "value": medicine_name or None,
            "source_snippet": snippet(medicine_name) or None,
            "confidence": "medium" if medicine_name else "low",
        },
        "active_ingredients": [
            {
                "name": claim,
                "strength": None,
                "source_snippet": snippet(claim),
                "confidence": "medium",
            }
            for claim in active_ingredients
        ],
        "usage_instructions": [
            {
                "instruction": claim,
                "source_snippet": snippet(claim),
                "confidence": "medium",
            }
            for claim in usage_instructions
        ],
        "warnings": [
            {
                "warning": claim,
                "severity": warning_severity(claim),
                "source_snippet": snippet(claim),
                "confidence": "medium",
            }
            for claim in warnings
        ],
        "contraindications": [
            {"text": claim, "source_snippet": snippet(claim), "confidence": "medium"}
            for claim in contraindications
        ],
        "side_effects": [
            {"text": claim, "source_snippet": snippet(claim), "confidence": "medium"}
            for claim in side_effects
        ],
        "storage": [
            {"text": claim, "source_snippet": snippet(claim), "confidence": "medium"}
            for claim in storage
        ],
        "plain_language_summary": plain_summary,
        "translated_summary": translated_summary,
        "needs_review": True,
        "review_notes": review_notes,
    }
    return validate_parsed_output(parsed)


def raw_provider_payload(
    provider: str, source_text: str, parsed_output: LeafletParsedOutput
) -> str:
    return json.dumps(
        {
            "provider": provider,
            "source_text_preview": snippet(source_text, limit=1200),
            "parsed_output": model_to_dict(parsed_output),
        },
        ensure_ascii=False,
    )


def mock_provider(leaflet_upload: dict[str, Any]) -> ExtractionResult:
    source_text = read_uploaded_text(leaflet_upload)
    if not source_text:
        source_text = (
            f"Uploaded leaflet file: {leaflet_upload['original_filename']}. "
            "The mock provider does not read image or PDF content."
        )
    parsed_output = heuristic_parse(
        source_text, leaflet_upload["original_filename"], "mock"
    )
    return ExtractionResult(
        provider="mock",
        source_text=source_text,
        raw_model_output=raw_provider_payload("mock", source_text, parsed_output),
        parsed_output=parsed_output,
    )


def local_ocr_provider(
    leaflet_upload: dict[str, Any], settings: Settings
) -> ExtractionResult:
    source_text = read_uploaded_text(leaflet_upload)
    if not source_text:
        source_text = run_local_ocr(leaflet_upload, settings)

    parsed_output = heuristic_parse(
        source_text, leaflet_upload["original_filename"], "local_ocr"
    )
    return ExtractionResult(
        provider="local_ocr",
        source_text=source_text,
        raw_model_output=raw_provider_payload("local_ocr", source_text, parsed_output),
        parsed_output=parsed_output,
    )


def run_local_ocr(leaflet_upload: dict[str, Any], settings: Settings) -> str:
    command = settings.local_ocr_command
    if not command:
        raise ExtractionProviderError("LOCAL_OCR_COMMAND is not configured.")

    content_type = infer_content_type(
        leaflet_upload, Path(str(leaflet_upload["source_file_path"]))
    )
    if content_type not in IMAGE_CONTENT_TYPES:
        raise ExtractionProviderError(
            "Local OCR currently supports text uploads directly and image uploads "
            "through the configured OCR command."
        )

    try:
        completed = subprocess.run(
            [command, str(leaflet_upload["source_file_path"]), "stdout"],
            check=False,
            capture_output=True,
            text=True,
            timeout=settings.local_ocr_timeout_seconds,
        )
    except FileNotFoundError as exc:
        raise ExtractionProviderError(
            f"Local OCR command '{command}' was not found."
        ) from exc
    except subprocess.TimeoutExpired as exc:
        raise ExtractionProviderError("Local OCR timed out.") from exc

    if completed.returncode != 0:
        error = completed.stderr.strip() or "Local OCR command failed."
        raise ExtractionProviderError(snippet(error, limit=500))

    source_text = completed.stdout.strip()
    if not source_text:
        raise ExtractionProviderError("Local OCR did not return readable text.")
    return source_text[:SOURCE_TEXT_LIMIT]


def openai_provider(
    leaflet_upload: dict[str, Any], settings: Settings
) -> ExtractionResult:
    if not settings.openai_api_key:
        raise ExtractionProviderError(
            "OPENAI_API_KEY is required when EXTRACTION_PROVIDER=openai."
        )
    if not settings.openai_extraction_model:
        raise ExtractionProviderError("OPENAI_EXTRACTION_MODEL is required.")

    source_text = read_uploaded_text(leaflet_upload)
    response_json = call_openai_responses_api(leaflet_upload, settings, source_text)
    output_text = extract_output_text(response_json)
    parsed_payload = parse_json_object(output_text)
    parsed_output = validate_parsed_output(parsed_payload)

    return ExtractionResult(
        provider="openai",
        source_text=source_text,
        raw_model_output=json.dumps(response_json, ensure_ascii=False),
        parsed_output=parsed_output,
    )


def call_openai_responses_api(
    leaflet_upload: dict[str, Any], settings: Settings, source_text: str
) -> dict[str, Any]:
    path = Path(str(leaflet_upload["source_file_path"]))
    content_type = infer_content_type(leaflet_upload, path)
    input_content: list[dict[str, Any]] = [
        {"type": "input_text", "text": PROMPT_GUARDRAILS}
    ]

    if source_text:
        input_content.append(
            {
                "type": "input_text",
                "text": f"Leaflet text:\n\n{source_text[:SOURCE_TEXT_LIMIT]}",
            }
        )
    else:
        file_data = build_data_url(path, content_type)
        if content_type in IMAGE_CONTENT_TYPES:
            input_content.append({"type": "input_image", "image_url": file_data})
        else:
            file_input: dict[str, Any] = {
                "type": "input_file",
                "filename": str(leaflet_upload["original_filename"]),
                "file_data": file_data,
            }
            if content_type == "application/pdf" or path.suffix.lower() == ".pdf":
                file_input["detail"] = "low"
            input_content.append(file_input)

    payload = {
        "model": settings.openai_extraction_model,
        "input": [{"role": "user", "content": input_content}],
        "text": {
            "format": {
                "type": "json_schema",
                "name": "leaflet_extraction",
                "schema": model_json_schema(LeafletParsedOutput),
                "strict": False,
            }
        },
    }
    request = Request(
        f"{settings.openai_api_base_url.rstrip('/')}/responses",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {settings.openai_api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=OPENAI_TIMEOUT_SECONDS) as response:
            return json.loads(response.read().decode("utf-8"))
    except HTTPError as exc:
        message = exc.read().decode("utf-8", errors="replace")
        raise ExtractionProviderError(
            f"OpenAI extraction failed with status {exc.code}: {snippet(message)}"
        ) from exc
    except URLError as exc:
        raise ExtractionProviderError(f"OpenAI extraction failed: {exc.reason}") from exc
    except TimeoutError as exc:
        raise ExtractionProviderError("OpenAI extraction timed out.") from exc
    except json.JSONDecodeError as exc:
        raise ExtractionProviderError("OpenAI extraction returned invalid JSON.") from exc


def build_data_url(path: Path, content_type: str) -> str:
    try:
        file_bytes = path.read_bytes()
    except OSError as exc:
        raise ExtractionProviderError("Uploaded leaflet file could not be read.") from exc

    mime_type = content_type or SUFFIX_CONTENT_TYPES.get(
        path.suffix.lower(), "application/octet-stream"
    )
    if mime_type == "application/octet-stream":
        mime_type = SUFFIX_CONTENT_TYPES.get(path.suffix.lower(), mime_type)
    return f"data:{mime_type};base64,{b64encode(file_bytes).decode('ascii')}"


def infer_content_type(leaflet_upload: dict[str, Any], path: Path) -> str:
    content_type = str(leaflet_upload.get("content_type", "")).split(";")[0].lower()
    if content_type and content_type != "application/octet-stream":
        return content_type
    return SUFFIX_CONTENT_TYPES.get(path.suffix.lower(), content_type)


def extract_output_text(response_json: dict[str, Any]) -> str:
    output_text = response_json.get("output_text")
    if isinstance(output_text, str) and output_text.strip():
        return output_text.strip()

    for output_item in response_json.get("output", []):
        if not isinstance(output_item, dict):
            continue
        for content_item in output_item.get("content", []):
            if not isinstance(content_item, dict):
                continue
            if isinstance(content_item.get("parsed"), dict):
                return json.dumps(content_item["parsed"], ensure_ascii=False)
            text_value = content_item.get("text")
            if isinstance(text_value, str) and text_value.strip():
                return text_value.strip()

    raise ExtractionProviderError("OpenAI extraction did not return output text.")


def parse_json_object(value: str) -> dict[str, Any]:
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError:
        match = re.search(r"\{.*\}", value, flags=re.DOTALL)
        if not match:
            raise ExtractionProviderError("Extraction output was not valid JSON.")
        try:
            parsed = json.loads(match.group(0))
        except json.JSONDecodeError as exc:
            raise ExtractionProviderError("Extraction output was not valid JSON.") from exc

    if not isinstance(parsed, dict):
        raise ExtractionProviderError("Extraction output must be a JSON object.")
    return parsed
