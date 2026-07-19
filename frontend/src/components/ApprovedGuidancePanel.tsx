import StatusBadge from "./StatusBadge";
import type {
  LeafletApprovedGuidance,
  LeafletConfidence,
  LeafletGuidance,
  LeafletWarningSeverity,
  TextClaimExtraction
} from "../types/medicine";

interface ApprovedGuidancePanelProps {
  guidance: LeafletGuidance[];
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

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function ApprovedGuidancePanel({ guidance }: ApprovedGuidancePanelProps) {
  return (
    <section className="approved-guidance-panel">
      <div className="section-heading">
        <div>
          <h3>Reviewed Leaflet Guidance</h3>
          <p className="review-subtitle">
            Approved notes are user-reviewed extracts from uploaded leaflets.
          </p>
        </div>
        <span className="muted-label">{guidance.length} saved</span>
      </div>

      {guidance.length === 0 ? (
        <div className="empty-state compact-empty">
          <h3>No reviewed guidance</h3>
          <p>Approved leaflet guidance will appear here.</p>
        </div>
      ) : (
        <div className="approved-guidance-list">
          {guidance.map((item) => (
            <article className="approved-guidance" key={item.id}>
              <div className="approved-guidance-header">
                <div>
                  <strong>
                    {item.guidance.medicine_name.value ||
                      "Reviewed leaflet guidance"}
                  </strong>
                  <span>Saved {formatDateTime(item.updated_at)}</span>
                </div>
                <StatusBadge tone="good">Approved</StatusBadge>
              </div>
              <GuidanceContent guidance={item.guidance} />
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function GuidanceContent({ guidance }: { guidance: LeafletApprovedGuidance }) {
  return (
    <div className="guidance-content">
      <div className="reviewed-safety">
        <strong>Use as reviewed reference only.</strong>
        <span>
          Follow clinician or pharmacist directions if they differ from this
          leaflet guidance.
        </span>
      </div>

      {guidance.plain_language_summary && (
        <section className="guidance-section">
          <h4>Plain-Language Summary</h4>
          <p>{guidance.plain_language_summary}</p>
        </section>
      )}

      {guidance.translated_summary && (
        <section className="guidance-section">
          <h4>Translated Summary</h4>
          <p>{guidance.translated_summary}</p>
        </section>
      )}

      {guidance.active_ingredients.length > 0 && (
        <section className="guidance-section">
          <h4>Active Ingredients</h4>
          <ul className="guidance-claim-list">
            {guidance.active_ingredients.map((item, index) => (
              <li key={`ingredient-${index}`}>
                <div className="guidance-claim-heading">
                  <strong>
                    {item.name}
                    {item.strength ? `, ${item.strength}` : ""}
                  </strong>
                  <StatusBadge tone={confidenceTone(item.confidence)}>
                    {item.confidence}
                  </StatusBadge>
                </div>
                <SourceSnippet value={item.source_snippet} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {guidance.usage_instructions.length > 0 && (
        <section className="guidance-section">
          <h4>Usage Instructions</h4>
          <ul className="guidance-claim-list">
            {guidance.usage_instructions.map((item, index) => (
              <li key={`usage-${index}`}>
                <div className="guidance-claim-heading">
                  <strong>{item.instruction}</strong>
                  <StatusBadge tone={confidenceTone(item.confidence)}>
                    {item.confidence}
                  </StatusBadge>
                </div>
                <SourceSnippet value={item.source_snippet} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {guidance.warnings.length > 0 && (
        <section className="guidance-section">
          <h4>Warnings</h4>
          <ul className="guidance-claim-list">
            {guidance.warnings.map((item, index) => (
              <li
                className={item.severity === "urgent" ? "urgent-claim" : ""}
                key={`warning-${index}`}
              >
                <div className="guidance-claim-heading">
                  <strong>{item.warning}</strong>
                  <div className="badge-row">
                    <StatusBadge tone={severityTone(item.severity)}>
                      {item.severity}
                    </StatusBadge>
                    <StatusBadge tone={confidenceTone(item.confidence)}>
                      {item.confidence}
                    </StatusBadge>
                  </div>
                </div>
                <SourceSnippet value={item.source_snippet} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <TextClaimSection title="Contraindications" items={guidance.contraindications} />
      <TextClaimSection title="Side Effects" items={guidance.side_effects} />
      <TextClaimSection title="Storage" items={guidance.storage} />

      {guidance.review_notes.length > 0 && (
        <section className="guidance-section">
          <h4>Review Notes</h4>
          <ul className="guidance-claim-list">
            {guidance.review_notes.map((note, index) => (
              <li key={`note-${index}`}>{note}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function TextClaimSection({
  title,
  items
}: {
  title: string;
  items: TextClaimExtraction[];
}) {
  if (items.length === 0) {
    return null;
  }

  return (
    <section className="guidance-section">
      <h4>{title}</h4>
      <ul className="guidance-claim-list">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>
            <div className="guidance-claim-heading">
              <strong>{item.text}</strong>
              <StatusBadge tone={confidenceTone(item.confidence)}>
                {item.confidence}
              </StatusBadge>
            </div>
            <SourceSnippet value={item.source_snippet} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function SourceSnippet({ value }: { value: string }) {
  return <p className="source-snippet">Source: {value}</p>;
}

export default ApprovedGuidancePanel;
