import StatusBadge from "./StatusBadge";
import { useI18n } from "../i18n";
import type {
  LeafletApprovedGuidance,
  LeafletConfidence,
  LeafletGuidance,
  LeafletWarningSeverity,
  TextClaimExtraction
} from "../types/medicine";

interface ApprovedGuidancePanelProps {
  guidance: LeafletGuidance[];
  isLoading: boolean;
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

function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

function ApprovedGuidancePanel({ guidance, isLoading }: ApprovedGuidancePanelProps) {
  const { locale, t } = useI18n();

  return (
    <section className="approved-guidance-panel">
      <div className="section-heading">
        <div>
          <h3>{t("Reviewed Leaflet Guidance")}</h3>
          <p className="review-subtitle">
            {t(
              "Approved notes are user-reviewed extracts from uploaded leaflets."
            )}
          </p>
        </div>
        <span className="muted-label">
          {isLoading ? t("Loading") : `${guidance.length} ${t("saved")}`}
        </span>
      </div>

      {isLoading ? (
        <div className="empty-state compact-empty">
          <h3>{t("Loading reviewed guidance")}</h3>
          <p>{t("Saved leaflet notes will appear in this section.")}</p>
        </div>
      ) : guidance.length === 0 ? (
        <div className="empty-state compact-empty">
          <h3>{t("No reviewed guidance")}</h3>
          <p>{t("Approved leaflet guidance will appear here.")}</p>
        </div>
      ) : (
        <div className="approved-guidance-list">
          {guidance.map((item) => (
            <article className="approved-guidance" key={item.id}>
              <div className="approved-guidance-header">
                <div>
                  <strong>
                    {item.guidance.medicine_name.value ||
                      t("Reviewed leaflet guidance")}
                  </strong>
                  <span>
                    {t("Saved")} {formatDateTime(item.updated_at, locale)}
                  </span>
                </div>
                <StatusBadge tone="good">{t("Approved")}</StatusBadge>
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
  const { t } = useI18n();

  return (
    <div className="guidance-content">
      <div className="reviewed-safety">
        <strong>{t("Use as reviewed reference only.")}</strong>
        <span>
          {t(
            "Follow clinician or pharmacist directions if they differ from this leaflet guidance."
          )}
        </span>
      </div>

      {guidance.plain_language_summary && (
        <section className="guidance-section">
          <h4>{t("Plain-Language Summary")}</h4>
          <p>{guidance.plain_language_summary}</p>
        </section>
      )}

      {guidance.translated_summary && (
        <section className="guidance-section">
          <h4>{t("Translated Summary")}</h4>
          <p>{guidance.translated_summary}</p>
        </section>
      )}

      {guidance.active_ingredients.length > 0 && (
        <section className="guidance-section">
          <h4>{t("Active Ingredients")}</h4>
          <ul className="guidance-claim-list">
            {guidance.active_ingredients.map((item, index) => (
              <li key={`ingredient-${index}`}>
                <div className="guidance-claim-heading">
                  <strong>
                    {item.name}
                    {item.strength ? `, ${item.strength}` : ""}
                  </strong>
                  <StatusBadge tone={confidenceTone(item.confidence)}>
                    {t(item.confidence)}
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
          <h4>{t("Usage Instructions")}</h4>
          <ul className="guidance-claim-list">
            {guidance.usage_instructions.map((item, index) => (
              <li key={`usage-${index}`}>
                <div className="guidance-claim-heading">
                  <strong>{item.instruction}</strong>
                  <StatusBadge tone={confidenceTone(item.confidence)}>
                    {t(item.confidence)}
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
          <h4>{t("Warnings")}</h4>
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
                      {t(item.severity)}
                    </StatusBadge>
                    <StatusBadge tone={confidenceTone(item.confidence)}>
                      {t(item.confidence)}
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
          <h4>{t("Review Notes")}</h4>
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
  const { t } = useI18n();

  if (items.length === 0) {
    return null;
  }

  return (
    <section className="guidance-section">
      <h4>{t(title)}</h4>
      <ul className="guidance-claim-list">
        {items.map((item, index) => (
          <li key={`${title}-${index}`}>
            <div className="guidance-claim-heading">
              <strong>{item.text}</strong>
              <StatusBadge tone={confidenceTone(item.confidence)}>
                {t(item.confidence)}
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
  const { t } = useI18n();
  return (
    <p className="source-snippet">
      {t("Source")}: {value}
    </p>
  );
}

export default ApprovedGuidancePanel;
