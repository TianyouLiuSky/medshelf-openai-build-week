# AI Extraction Contract

## Purpose

The AI extraction contract defines the structured output expected from a medicine leaflet image or text. The app should treat this as draft information until the user reviews it.

## System Behavior

The model should:

- Extract only information visible in the provided leaflet/package text.
- Translate and simplify instructions when requested.
- Preserve uncertainty.
- Avoid medical advice beyond the provided source.
- Never infer dosage from general knowledge.
- Flag unreadable or contradictory content.

## Suggested JSON Shape

```json
{
  "medicine_name": {
    "value": "string or null",
    "source_snippet": "string or null",
    "confidence": "high | medium | low"
  },
  "active_ingredients": [
    {
      "name": "string",
      "strength": "string or null",
      "source_snippet": "string",
      "confidence": "high | medium | low"
    }
  ],
  "usage_instructions": [
    {
      "instruction": "string",
      "source_snippet": "string",
      "confidence": "high | medium | low"
    }
  ],
  "warnings": [
    {
      "warning": "string",
      "severity": "info | caution | urgent",
      "source_snippet": "string",
      "confidence": "high | medium | low"
    }
  ],
  "contraindications": [
    {
      "text": "string",
      "source_snippet": "string",
      "confidence": "high | medium | low"
    }
  ],
  "side_effects": [
    {
      "text": "string",
      "source_snippet": "string",
      "confidence": "high | medium | low"
    }
  ],
  "storage": [
    {
      "text": "string",
      "source_snippet": "string",
      "confidence": "high | medium | low"
    }
  ],
  "plain_language_summary": "string",
  "translated_summary": "string",
  "needs_review": true,
  "review_notes": [
    "string"
  ]
}
```

## Prompt Guardrails

Use instructions similar to:

```text
You are extracting information from medicine packaging or a patient leaflet.
Only use information visible in the provided input.
Do not infer missing dosage, warnings, or side effects from general knowledge.
If text is unclear, mark confidence as low and add a review note.
Return valid JSON matching the requested schema.
This output is for user review and is not medical advice.
```

## UI Requirements For AI Output

- Show source snippets near extracted claims.
- Show confidence labels.
- Highlight low-confidence and urgent warning items.
- Require approval before attaching guidance to a medicine.
- Let users edit or remove extracted fields.

