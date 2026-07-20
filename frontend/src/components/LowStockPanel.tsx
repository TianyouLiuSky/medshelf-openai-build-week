import StatusBadge from "./StatusBadge";
import { useI18n } from "../i18n";
import type { Medication, RestockSuggestion } from "../types/medicine";

interface LowStockPanelProps {
  medications: Medication[];
  suggestions: Record<number, RestockSuggestion>;
  isLoading: boolean;
  onSelectMedication: (id: number) => void;
}

function formatDaysRemaining(
  value: number | null,
  formatNumber: (value: number) => string,
  t: (key: string) => string
): string {
  if (value === null) {
    return t("Estimate unavailable");
  }

  if (value === 0) {
    return `0 ${t("days")}`;
  }

  return `${formatNumber(value)} ${t("days")}`;
}

function LowStockPanel({
  medications,
  suggestions,
  isLoading,
  onSelectMedication
}: LowStockPanelProps) {
  const { formatNumber, t } = useI18n();
  const lowStockMedications = medications.filter(
    (medication) => medication.is_low_stock
  );

  return (
    <section className="low-stock-panel" aria-labelledby="low-stock-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("Inventory")}</p>
          <h2 id="low-stock-title">{t("Low Stock")}</h2>
        </div>
        {isLoading && <span className="muted-label">{t("Checking links")}</span>}
      </div>

      {lowStockMedications.length === 0 ? (
        <div className="empty-state compact-empty">
          <h3>{t("Stock looks steady")}</h3>
          <p>{t("No medicines are below their low-stock threshold.")}</p>
        </div>
      ) : (
        <div className="low-stock-list">
          {lowStockMedications.map((medication) => {
            const suggestion = suggestions[medication.id];

            return (
              <article className="low-stock-card" key={medication.id}>
                <div className="low-stock-card-main">
                  <div className="low-stock-title-row">
                    <h3>{medication.name}</h3>
                    <StatusBadge tone="danger">{t("Low stock")}</StatusBadge>
                  </div>
                  <p>
                    {formatNumber(medication.quantity_remaining)}{" "}
                    {medication.quantity_unit} {t("remaining")}
                    {medication.low_stock_threshold !== null
                      ? ` / ${t("threshold")} ${formatNumber(
                          medication.low_stock_threshold
                        )}`
                      : ""}
                  </p>
                  <span>
                    {formatDaysRemaining(
                      medication.days_remaining_estimate,
                      formatNumber,
                      t
                    )}
                  </span>
                </div>

                <div className="restock-actions">
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    onClick={() => onSelectMedication(medication.id)}
                  >
                    {t("View")}
                  </button>
                  {suggestion?.links.map((link) => (
                    <a
                      className="restock-link"
                      href={link.url}
                      key={link.label}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {t(link.label)}
                    </a>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default LowStockPanel;
