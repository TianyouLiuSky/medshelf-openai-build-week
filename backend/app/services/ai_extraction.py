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
CLIENT_TEXT_PROVIDER = "browser_ocr"
TEXT_CONTENT_TYPES = {"text/plain"}
IMAGE_CONTENT_TYPES = {
    "image/bmp",
    "image/gif",
    "image/heic",
    "image/heif",
    "image/jpeg",
    "image/png",
    "image/tiff",
    "image/webp",
}
SUFFIX_CONTENT_TYPES = {
    ".bmp": "image/bmp",
    ".gif": "image/gif",
    ".heic": "image/heic",
    ".heif": "image/heif",
    ".jpeg": "image/jpeg",
    ".jpg": "image/jpeg",
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".tif": "image/tiff",
    ".tiff": "image/tiff",
    ".txt": "text/plain",
    ".webp": "image/webp",
    ".zip": "application/zip",
}
OPENAI_TIMEOUT_SECONDS = 60
SOURCE_TEXT_LIMIT = 60000

BOUNDARY_SECTION_KEY = "__boundary__"
BRACKETED_HEADING_PATTERN = re.compile(
    r"^[【\[]\s*(?P<label>[^】\]\n]{1,40})\s*[】\]]\s*[：:]?\s*(?P<rest>.*)$"
)
COLON_HEADING_PATTERN = re.compile(
    r"^(?P<label>[^：:\n]{1,40})\s*[：:]\s*(?P<rest>.*)$"
)
PAGE_MARKER_PATTERN = re.compile(r"^[-\s]*(page|页|第)\s*\d+", re.IGNORECASE)


def contains_cjk(value: str) -> bool:
    return bool(re.search(r"[\u3400-\u9fff]", value))


def normalize_heading_label(value: str) -> str:
    normalized = value.strip().lower()
    normalized = re.sub(r"^[【\[\(（]+", "", normalized)
    normalized = re.sub(r"[】\]\)）]+$", "", normalized)
    normalized = normalized.strip().rstrip(":：").strip()
    normalized = re.sub(r"\s+", " ", normalized)
    if contains_cjk(normalized):
        normalized = normalized.replace(" ", "")
    return normalized


RAW_SECTION_HEADINGS = {
    "medicine_name": {
        "medicine name",
        "name",
        "product name",
        "brand name",
        "药品名称",
        "通用名称",
        "商品名称",
        "英文名称",
        "汉语拼音",
        "中文名称",
    },
    "active_ingredients": {
        "active ingredient",
        "active ingredients",
        "ingredients",
        "composition",
        "成份",
        "成分",
        "主要成份",
        "主要成分",
        "有效成份",
        "有效成分",
        "组份",
        "组分",
        "处方组成",
    },
    "usage_instructions": {
        "directions",
        "usage",
        "instructions",
        "how to use",
        "dosage",
        "dosage and administration",
        "用法用量",
        "用法",
        "用量",
        "服用方法",
        "服法",
        "接种程序",
        "接种方法",
        "接种途径",
        "免疫程序",
        "免疫程序和剂量",
    },
    "warnings": {
        "warning",
        "warnings",
        "precautions",
        "precaution",
        "注意事项",
        "警告",
        "警示语",
        "安全警示",
        "特别警示",
        "慎用",
        "孕妇及哺乳期妇女用药",
        "妊娠及哺乳期妇女用药",
        "孕妇用药",
        "哺乳期妇女用药",
        "儿童用药",
        "老年用药",
        "特殊人群用药",
        "药物相互作用",
        "药品相互作用",
        "药物滥用和药物依赖",
        "药物滥用",
        "药物依赖",
        "药物过量",
        "使用限制",
    },
    "contraindications": {
        "contraindication",
        "contraindications",
        "do not use",
        "禁忌",
        "禁忌证",
        "禁忌症",
        "禁用",
    },
    "side_effects": {
        "side effect",
        "side effects",
        "possible side effects",
        "adverse reactions",
        "不良反应",
        "副作用",
    },
    "storage": {
        "storage",
        "how to store",
        "store",
        "储存",
        "储存条件",
        "储存方法",
        "储藏",
        "贮藏",
        "贮藏条件",
        "贮藏方法",
        "贮存",
        "保存",
        "保存条件",
        "保存方法",
        "存储",
    },
}
RAW_BOUNDARY_HEADINGS = {
    "approval date",
    "description",
    "dose form",
    "indications",
    "indication",
    "manufacturer",
    "marketing authorization holder",
    "package",
    "specification",
    "expiry",
    "product batch number",
    "revision date",
    "standard",
    "核准日期",
    "修改日期",
    "核准和修改日期",
    "特殊药品",
    "特殊药品标识",
    "外用药品标识",
    "非处方药标识",
    "处方药标识",
    "说明书标题",
    "请仔细阅读说明书",
    "性状",
    "作用类别",
    "适应症",
    "适应证",
    "适应症或功能主治",
    "适应证或功能主治",
    "适应症/功能主治",
    "适应证/功能主治",
    "功能主治",
    "作用与用途",
    "接种对象",
    "规格",
    "临床药理",
    "临床试验",
    "药理毒理",
    "药代动力学",
    "药物代谢动力学",
    "药效学",
    "作用机制",
    "遗传药理学",
    "处方来源",
    "包装",
    "包装规格",
    "包装材料",
    "直接接触药品的包装材料和容器",
    "有效期",
    "执行标准",
    "批准文号",
    "批准文号/进口药品注册证号/医药产品注册证号",
    "进口药品注册证号",
    "医药产品注册证号",
    "生产日期",
    "产品批号",
    "批号",
    "上市许可持有人",
    "药品上市许可持有人",
    "生产企业",
    "生产厂商",
    "包装厂",
    "境内联系人",
    "境内联系机构",
    "名称",
    "企业名称",
    "注册地址",
    "生产地址",
    "包装地址",
    "地址",
    "邮政编码",
    "邮编",
    "电话",
    "传真",
    "电话和传真号码",
    "网址",
    "条形码",
    "二维码",
    "电子监管码",
    "运输注意事项",
}
SECTION_HEADINGS = {
    key: {normalize_heading_label(heading) for heading in headings}
    for key, headings in RAW_SECTION_HEADINGS.items()
}
SECTION_HEADING_LOOKUP = {
    heading: key for key, headings in SECTION_HEADINGS.items() for heading in headings
}
BOUNDARY_HEADINGS = {
    normalize_heading_label(heading) for heading in RAW_BOUNDARY_HEADINGS
}
HEADING_PREFIXES = sorted(
    [
        *SECTION_HEADING_LOOKUP.items(),
        *((heading, BOUNDARY_SECTION_KEY) for heading in BOUNDARY_HEADINGS),
    ],
    key=lambda item: len(item[0]),
    reverse=True,
)

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


def browser_ocr_text_provider(
    leaflet_upload: dict[str, Any], source_text: str
) -> ExtractionResult:
    normalized_text = source_text.strip()[:SOURCE_TEXT_LIMIT]
    if not normalized_text:
        raise ExtractionProviderError("OCR text is required before extraction.")

    parsed_output = heuristic_parse(
        normalized_text, leaflet_upload["original_filename"], CLIENT_TEXT_PROVIDER
    )
    return ExtractionResult(
        provider=CLIENT_TEXT_PROVIDER,
        source_text=normalized_text,
        raw_model_output=raw_provider_payload(
            CLIENT_TEXT_PROVIDER,
            normalized_text,
            parsed_output,
        ),
        parsed_output=parsed_output,
    )


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
    return normalize_heading_label(line)


def lookup_section_heading(label: str) -> str:
    normalized = normalize_heading_label(label)
    if normalized in SECTION_HEADING_LOOKUP:
        return SECTION_HEADING_LOOKUP[normalized]
    if normalized in BOUNDARY_HEADINGS:
        return BOUNDARY_SECTION_KEY
    return ""


def match_section_heading(line: str) -> tuple[str, str]:
    stripped = line.strip()
    if not stripped:
        return "", ""

    for pattern in (BRACKETED_HEADING_PATTERN, COLON_HEADING_PATTERN):
        match = pattern.match(stripped)
        if not match:
            continue
        matched_key = lookup_section_heading(match.group("label"))
        if matched_key:
            return matched_key, match.group("rest").strip()

    exact_key = lookup_section_heading(stripped)
    if exact_key:
        return exact_key, ""

    compact_line = normalize_heading_label(stripped)
    for heading, matched_key in HEADING_PREFIXES:
        if not contains_cjk(heading):
            continue
        if compact_line.startswith(heading) and len(compact_line) > len(heading):
            rest = stripped[len(heading) :].strip(" ：:")
            return matched_key, rest

    return "", ""


def extract_sections(text: str) -> dict[str, str]:
    sections: dict[str, list[str]] = {}
    current_key = ""

    for line in text.splitlines():
        clean_line = line.strip()
        if not clean_line:
            continue

        if PAGE_MARKER_PATTERN.match(clean_line):
            current_key = ""
            continue

        matched_key, inline_text = match_section_heading(clean_line)
        if matched_key:
            if matched_key == BOUNDARY_SECTION_KEY:
                current_key = ""
                continue

            current_key = matched_key
            sections.setdefault(current_key, [])
            if inline_text:
                nested_key, nested_text = match_section_heading(inline_text)
                if nested_key and nested_key != BOUNDARY_SECTION_KEY:
                    current_key = nested_key
                    sections.setdefault(current_key, [])
                    if nested_text:
                        sections[current_key].append(nested_text)
                elif not nested_key:
                    sections[current_key].append(inline_text)
            continue

        if current_key:
            sections[current_key].append(clean_line)

    parsed_sections: dict[str, str] = {}
    for key, lines in sections.items():
        claims = [collapse_whitespace(line) for line in lines]
        cleaned_claims = [claim for claim in claims if claim]
        if cleaned_claims:
            parsed_sections[key] = "\n".join(cleaned_claims)
    return parsed_sections


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
    claims = [snippet(line, limit=1000) for line in lines if line]
    if claims:
        return claims

    return [snippet(section_text, limit=1000)]


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
    medicine_name_claims = split_claims(sections.get("medicine_name", ""))
    medicine_name = (
        snippet(medicine_name_claims[0], limit=240) if medicine_name_claims else ""
    )
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
                "name": snippet(claim, limit=240),
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
