import { FormEvent, useEffect, useState } from "react";

import StatusBadge from "./StatusBadge";
import type {
  ActiveIngredientExtraction,
  LeafletConfidence,
  LeafletExtraction,
  LeafletGuidancePayload,
  LeafletWarningSeverity,
  TextClaimExtraction,
  UsageInstructionExtraction,
  WarningExtraction
} from "../types/medicine";

interface LeafletReviewPanelProps {
  extraction: LeafletExtraction | null;
  isLoading: boolean;
  isApproving: boolean;
  onApprove: (
    extraction: LeafletExtraction,
    guidance: LeafletGuidancePayload
  ) => Promise<void>;
  onCancel: () => void;
}

const confidenceOptions: LeafletConfidence[] = ["high", "medium", "low"];
const severityOptions: LeafletWarningSeverity[] = ["info", "caution", "urgent"];

function emptyDraft(): LeafletGuidancePayload {
  return {
    medicine_name: {
      value: null,
      source_snippet: null,
      confidence: "low"
    },
    active_ingredients: [],
    usage_instructions: [],
    warnings: [],
    contraindications: [],
    side_effects: [],
    storage: [],
    plain_language_summary: "",
    translated_summary: "",
    review_notes: []
  };
}

function cloneDraft(draft: LeafletGuidancePayload): LeafletGuidancePayload {
  return JSON.parse(JSON.stringify(draft)) as LeafletGuidancePayload;
}

function trimOrNull(value: string | null): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed || null;
}

function cleanDraft(draft: LeafletGuidancePayload): LeafletGuidancePayload {
  return {
    medicine_name: {
      value: trimOrNull(draft.medicine_name.value),
      source_snippet: trimOrNull(draft.medicine_name.source_snippet),
      confidence: draft.medicine_name.confidence
    },
    active_ingredients: draft.active_ingredients
      .map((item) => ({
        name: item.name.trim(),
        strength: trimOrNull(item.strength),
        source_snippet: item.source_snippet.trim(),
        confidence: item.confidence
      }))
      .filter((item) => item.name && item.source_snippet),
    usage_instructions: draft.usage_instructions
      .map((item) => ({
        instruction: item.instruction.trim(),
        source_snippet: item.source_snippet.trim(),
        confidence: item.confidence
      }))
      .filter((item) => item.instruction && item.source_snippet),
    warnings: draft.warnings
      .map((item) => ({
        warning: item.warning.trim(),
        severity: item.severity,
        source_snippet: item.source_snippet.trim(),
        confidence: item.confidence
      }))
      .filter((item) => item.warning && item.source_snippet),
    contraindications: cleanTextClaims(draft.contraindications),
    side_effects: cleanTextClaims(draft.side_effects),
    storage: cleanTextClaims(draft.storage),
    plain_language_summary: draft.plain_language_summary.trim(),
    translated_summary: draft.translated_summary.trim(),
    review_notes: draft.review_notes.map((note) => note.trim()).filter(Boolean)
  };
}

function cleanTextClaims(items: TextClaimExtraction[]): TextClaimExtraction[] {
  return items
    .map((item) => ({
      text: item.text.trim(),
      source_snippet: item.source_snippet.trim(),
      confidence: item.confidence
    }))
    .filter((item) => item.text && item.source_snippet);
}

function validateDraft(draft: LeafletGuidancePayload): string {
  if (!draft.plain_language_summary.trim()) {
    return "Add a reviewed plain-language summary before approving.";
  }

  for (const item of draft.active_ingredients) {
    if (item.name.trim() && !item.source_snippet.trim()) {
      return "Every active ingredient kept for approval needs a source snippet.";
    }
  }
  for (const item of draft.usage_instructions) {
    if (item.instruction.trim() && !item.source_snippet.trim()) {
      return "Every usage instruction kept for approval needs a source snippet.";
    }
  }
  for (const item of draft.warnings) {
    if (item.warning.trim() && !item.source_snippet.trim()) {
      return "Every warning kept for approval needs a source snippet.";
    }
  }

  const textSections = [
    { label: "contraindication", items: draft.contraindications },
    { label: "side effect", items: draft.side_effects },
    { label: "storage item", items: draft.storage }
  ];
  for (const section of textSections) {
    for (const item of section.items) {
      if (item.text.trim() && !item.source_snippet.trim()) {
        return `Every ${section.label} kept for approval needs a source snippet.`;
      }
    }
  }

  return "";
}

function confidenceTone(
  confidence: LeafletConfidence
): "neutral" | "good" | "warning" | "danger" {
  if (confidence === "high") {
    return "good";
  }
  if (confidence === "medium") {
    return "warning";
  }
  return "danger";
}

function severityTone(
  severity: LeafletWarningSeverity
): "neutral" | "good" | "warning" | "danger" {
  if (severity === "urgent") {
    return "danger";
  }
  if (severity === "caution") {
    return "warning";
  }
  return "neutral";
}

function ConfidenceField({
  value,
  onChange
}: {
  value: LeafletConfidence;
  onChange: (confidence: LeafletConfidence) => void;
}) {
  return (
    <label className="compact-field">
      <span>Confidence</span>
      <div className="select-with-badge">
        <StatusBadge tone={confidenceTone(value)}>{value}</StatusBadge>
        <select
          value={value}
          onChange={(event) =>
            onChange(event.target.value as LeafletConfidence)
          }
        >
          {confidenceOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>
    </label>
  );
}

function LeafletReviewPanel({
  extraction,
  isLoading,
  isApproving,
  onApprove,
  onCancel
}: LeafletReviewPanelProps) {
  const [draft, setDraft] = useState<LeafletGuidancePayload>(emptyDraft);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setFormError("");
    if (!extraction?.parsed_output) {
      setDraft(emptyDraft());
      return;
    }
    setDraft(cloneDraft(extraction.parsed_output));
  }, [extraction]);

  if (isLoading) {
    return (
      <section className="review-panel" aria-live="polite">
        <div className="section-heading">
          <h3>AI Review</h3>
          <span className="muted-label">Loading</span>
        </div>
      </section>
    );
  }

  if (!extraction) {
    return null;
  }

  if (!extraction.parsed_output) {
    return (
      <section className="review-panel">
        <div className="section-heading">
          <h3>AI Review</h3>
          <button className="text-button" type="button" onClick={onCancel}>
            Close
          </button>
        </div>
        <p className="form-error">
          This extraction does not have parsed output to review.
        </p>
      </section>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!extraction) {
      return;
    }

    const validationError = validateDraft(draft);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    const confirmed = window.confirm(
      "Approve this reviewed leaflet guidance? It will be saved to the medicine profile."
    );
    if (!confirmed) {
      return;
    }

    setFormError("");
    await onApprove(extraction, cleanDraft(draft));
  }

  function updateMedicineName(
    changes: Partial<LeafletGuidancePayload["medicine_name"]>
  ) {
    setDraft((current) => ({
      ...current,
      medicine_name: { ...current.medicine_name, ...changes }
    }));
  }

  function updateActiveIngredient(
    index: number,
    changes: Partial<ActiveIngredientExtraction>
  ) {
    setDraft((current) => ({
      ...current,
      active_ingredients: current.active_ingredients.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item
      )
    }));
  }

  function updateUsageInstruction(
    index: number,
    changes: Partial<UsageInstructionExtraction>
  ) {
    setDraft((current) => ({
      ...current,
      usage_instructions: current.usage_instructions.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item
      )
    }));
  }

  function updateWarning(index: number, changes: Partial<WarningExtraction>) {
    setDraft((current) => ({
      ...current,
      warnings: current.warnings.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item
      )
    }));
  }

  function updateTextClaim(
    key: "contraindications" | "side_effects" | "storage",
    index: number,
    changes: Partial<TextClaimExtraction>
  ) {
    setDraft((current) => ({
      ...current,
      [key]: current[key].map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...changes } : item
      )
    }));
  }

  return (
    <section className="review-panel" aria-labelledby="leaflet-review-title">
      <div className="section-heading">
        <div>
          <h3 id="leaflet-review-title">AI Review</h3>
          <p className="review-subtitle">
            Draft extraction from {extraction.provider}. Edit or remove anything
            uncertain before approval.
          </p>
        </div>
        <button className="text-button" type="button" onClick={onCancel}>
          Close
        </button>
      </div>

      <div className="review-safety">
        <strong>Review-only until approved.</strong>
        <span>
          This is not medical advice. Compare every field with the leaflet and
          clinician or pharmacist directions before saving it.
        </span>
      </div>

      <form className="review-form" onSubmit={handleSubmit}>
        <section className="review-section">
          <div className="section-heading">
            <h4>Medicine Name</h4>
            <button
              className="text-button danger-text"
              type="button"
              onClick={() =>
                updateMedicineName({ value: null, source_snippet: null })
              }
            >
              Clear
            </button>
          </div>
          <div className="review-grid">
            <label>
              <span>Name</span>
              <input
                value={draft.medicine_name.value ?? ""}
                onChange={(event) =>
                  updateMedicineName({ value: event.target.value })
                }
              />
            </label>
            <ConfidenceField
              value={draft.medicine_name.confidence}
              onChange={(confidence) => updateMedicineName({ confidence })}
            />
          </div>
          <label>
            <span>Source snippet</span>
            <textarea
              rows={2}
              value={draft.medicine_name.source_snippet ?? ""}
              onChange={(event) =>
                updateMedicineName({ source_snippet: event.target.value })
              }
            />
          </label>
        </section>

        <section className="review-section">
          <div className="section-heading">
            <h4>Active Ingredients</h4>
            <button
              className="secondary-button compact-button"
              type="button"
              onClick={() =>
                setDraft((current) => ({
                  ...current,
                  active_ingredients: [
                    ...current.active_ingredients,
                    {
                      name: "",
                      strength: "",
                      source_snippet: "",
                      confidence: "low"
                    }
                  ]
                }))
              }
            >
              Add
            </button>
          </div>
          {draft.active_ingredients.map((item, index) => (
            <article
              className={`review-item ${
                item.confidence === "low" ? "is-low-confidence" : ""
              }`}
              key={`ingredient-${index}`}
            >
              <div className="review-item-heading">
                <StatusBadge tone={confidenceTone(item.confidence)}>
                  {item.confidence}
                </StatusBadge>
                <button
                  className="text-button danger-text"
                  type="button"
                  onClick={() =>
                    setDraft((current) => ({
                      ...current,
                      active_ingredients: current.active_ingredients.filter(
                        (_, itemIndex) => itemIndex !== index
                      )
                    }))
                  }
                >
                  Remove
                </button>
              </div>
              <div className="review-grid">
                <label>
                  <span>Name</span>
                  <input
                    value={item.name}
                    onChange={(event) =>
                      updateActiveIngredient(index, {
                        name: event.target.value
                      })
                    }
                  />
                </label>
                <label>
                  <span>Strength</span>
                  <input
                    value={item.strength ?? ""}
                    onChange={(event) =>
                      updateActiveIngredient(index, {
                        strength: event.target.value
                      })
                    }
                  />
                </label>
              </div>
              <ConfidenceField
                value={item.confidence}
                onChange={(confidence) =>
                  updateActiveIngredient(index, { confidence })
                }
              />
              <label>
                <span>Source snippet</span>
                <textarea
                  rows={2}
                  value={item.source_snippet}
                  onChange={(event) =>
                    updateActiveIngredient(index, {
                      source_snippet: event.target.value
                    })
                  }
                />
              </label>
            </article>
          ))}
        </section>

        <EditableUsageSection
          items={draft.usage_instructions}
          onAdd={() =>
            setDraft((current) => ({
              ...current,
              usage_instructions: [
                ...current.usage_instructions,
                {
                  instruction: "",
                  source_snippet: "",
                  confidence: "low"
                }
              ]
            }))
          }
          onRemove={(index) =>
            setDraft((current) => ({
              ...current,
              usage_instructions: current.usage_instructions.filter(
                (_, itemIndex) => itemIndex !== index
              )
            }))
          }
          onUpdate={updateUsageInstruction}
        />

        <EditableWarningSection
          items={draft.warnings}
          onAdd={() =>
            setDraft((current) => ({
              ...current,
              warnings: [
                ...current.warnings,
                {
                  warning: "",
                  severity: "caution",
                  source_snippet: "",
                  confidence: "low"
                }
              ]
            }))
          }
          onRemove={(index) =>
            setDraft((current) => ({
              ...current,
              warnings: current.warnings.filter(
                (_, itemIndex) => itemIndex !== index
              )
            }))
          }
          onUpdate={updateWarning}
        />

        <EditableTextClaimSection
          title="Contraindications"
          items={draft.contraindications}
          onAdd={() =>
            setDraft((current) => ({
              ...current,
              contraindications: [
                ...current.contraindications,
                { text: "", source_snippet: "", confidence: "low" }
              ]
            }))
          }
          onRemove={(index) =>
            setDraft((current) => ({
              ...current,
              contraindications: current.contraindications.filter(
                (_, itemIndex) => itemIndex !== index
              )
            }))
          }
          onUpdate={(index, changes) =>
            updateTextClaim("contraindications", index, changes)
          }
        />

        <EditableTextClaimSection
          title="Side Effects"
          items={draft.side_effects}
          onAdd={() =>
            setDraft((current) => ({
              ...current,
              side_effects: [
                ...current.side_effects,
                { text: "", source_snippet: "", confidence: "low" }
              ]
            }))
          }
          onRemove={(index) =>
            setDraft((current) => ({
              ...current,
              side_effects: current.side_effects.filter(
                (_, itemIndex) => itemIndex !== index
              )
            }))
          }
          onUpdate={(index, changes) =>
            updateTextClaim("side_effects", index, changes)
          }
        />

        <EditableTextClaimSection
          title="Storage"
          items={draft.storage}
          onAdd={() =>
            setDraft((current) => ({
              ...current,
              storage: [
                ...current.storage,
                { text: "", source_snippet: "", confidence: "low" }
              ]
            }))
          }
          onRemove={(index) =>
            setDraft((current) => ({
              ...current,
              storage: current.storage.filter(
                (_, itemIndex) => itemIndex !== index
              )
            }))
          }
          onUpdate={(index, changes) =>
            updateTextClaim("storage", index, changes)
          }
        />

        <section className="review-section">
          <h4>Summaries And Notes</h4>
          <label>
            <span>Plain-language summary</span>
            <textarea
              rows={4}
              value={draft.plain_language_summary}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  plain_language_summary: event.target.value
                }))
              }
            />
          </label>
          <label>
            <span>Translated summary</span>
            <textarea
              rows={4}
              value={draft.translated_summary}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  translated_summary: event.target.value
                }))
              }
            />
          </label>
          <label>
            <span>Review notes</span>
            <textarea
              rows={4}
              value={draft.review_notes.join("\n")}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  review_notes: event.target.value.split("\n")
                }))
              }
            />
          </label>
        </section>

        {formError && <p className="form-error">{formError}</p>}

        <div className="form-actions">
          <button
            className="primary-button"
            type="submit"
            disabled={isApproving}
          >
            {isApproving ? "Saving" : "Approve guidance"}
          </button>
          <button className="secondary-button" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function EditableUsageSection({
  items,
  onAdd,
  onRemove,
  onUpdate
}: {
  items: UsageInstructionExtraction[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (
    index: number,
    changes: Partial<UsageInstructionExtraction>
  ) => void;
}) {
  return (
    <section className="review-section">
      <div className="section-heading">
        <h4>Usage Instructions</h4>
        <button
          className="secondary-button compact-button"
          type="button"
          onClick={onAdd}
        >
          Add
        </button>
      </div>
      {items.map((item, index) => (
        <article
          className={`review-item ${
            item.confidence === "low" ? "is-low-confidence" : ""
          }`}
          key={`usage-${index}`}
        >
          <div className="review-item-heading">
            <StatusBadge tone={confidenceTone(item.confidence)}>
              {item.confidence}
            </StatusBadge>
            <button
              className="text-button danger-text"
              type="button"
              onClick={() => onRemove(index)}
            >
              Remove
            </button>
          </div>
          <label>
            <span>Instruction</span>
            <textarea
              rows={3}
              value={item.instruction}
              onChange={(event) =>
                onUpdate(index, { instruction: event.target.value })
              }
            />
          </label>
          <ConfidenceField
            value={item.confidence}
            onChange={(confidence) => onUpdate(index, { confidence })}
          />
          <label>
            <span>Source snippet</span>
            <textarea
              rows={2}
              value={item.source_snippet}
              onChange={(event) =>
                onUpdate(index, { source_snippet: event.target.value })
              }
            />
          </label>
        </article>
      ))}
    </section>
  );
}

function EditableWarningSection({
  items,
  onAdd,
  onRemove,
  onUpdate
}: {
  items: WarningExtraction[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, changes: Partial<WarningExtraction>) => void;
}) {
  return (
    <section className="review-section">
      <div className="section-heading">
        <h4>Warnings</h4>
        <button
          className="secondary-button compact-button"
          type="button"
          onClick={onAdd}
        >
          Add
        </button>
      </div>
      {items.map((item, index) => (
        <article
          className={`review-item ${
            item.confidence === "low" ? "is-low-confidence" : ""
          } ${item.severity === "urgent" ? "is-urgent-warning" : ""}`}
          key={`warning-${index}`}
        >
          <div className="review-item-heading">
            <div className="badge-row">
              <StatusBadge tone={severityTone(item.severity)}>
                {item.severity}
              </StatusBadge>
              <StatusBadge tone={confidenceTone(item.confidence)}>
                {item.confidence}
              </StatusBadge>
            </div>
            <button
              className="text-button danger-text"
              type="button"
              onClick={() => onRemove(index)}
            >
              Remove
            </button>
          </div>
          <label>
            <span>Warning</span>
            <textarea
              rows={3}
              value={item.warning}
              onChange={(event) =>
                onUpdate(index, { warning: event.target.value })
              }
            />
          </label>
          <div className="review-grid">
            <label className="compact-field">
              <span>Severity</span>
              <select
                value={item.severity}
                onChange={(event) =>
                  onUpdate(index, {
                    severity: event.target.value as LeafletWarningSeverity
                  })
                }
              >
                {severityOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <ConfidenceField
              value={item.confidence}
              onChange={(confidence) => onUpdate(index, { confidence })}
            />
          </div>
          <label>
            <span>Source snippet</span>
            <textarea
              rows={2}
              value={item.source_snippet}
              onChange={(event) =>
                onUpdate(index, { source_snippet: event.target.value })
              }
            />
          </label>
        </article>
      ))}
    </section>
  );
}

function EditableTextClaimSection({
  title,
  items,
  onAdd,
  onRemove,
  onUpdate
}: {
  title: string;
  items: TextClaimExtraction[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, changes: Partial<TextClaimExtraction>) => void;
}) {
  return (
    <section className="review-section">
      <div className="section-heading">
        <h4>{title}</h4>
        <button
          className="secondary-button compact-button"
          type="button"
          onClick={onAdd}
        >
          Add
        </button>
      </div>
      {items.map((item, index) => (
        <article
          className={`review-item ${
            item.confidence === "low" ? "is-low-confidence" : ""
          }`}
          key={`${title}-${index}`}
        >
          <div className="review-item-heading">
            <StatusBadge tone={confidenceTone(item.confidence)}>
              {item.confidence}
            </StatusBadge>
            <button
              className="text-button danger-text"
              type="button"
              onClick={() => onRemove(index)}
            >
              Remove
            </button>
          </div>
          <label>
            <span>Text</span>
            <textarea
              rows={3}
              value={item.text}
              onChange={(event) => onUpdate(index, { text: event.target.value })}
            />
          </label>
          <ConfidenceField
            value={item.confidence}
            onChange={(confidence) => onUpdate(index, { confidence })}
          />
          <label>
            <span>Source snippet</span>
            <textarea
              rows={2}
              value={item.source_snippet}
              onChange={(event) =>
                onUpdate(index, { source_snippet: event.target.value })
              }
            />
          </label>
        </article>
      ))}
    </section>
  );
}

export default LeafletReviewPanel;
