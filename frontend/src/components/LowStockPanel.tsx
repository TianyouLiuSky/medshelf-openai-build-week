import StatusBadge from "./StatusBadge";
import type { Medication, RestockSuggestion } from "../types/medicine";

interface LowStockPanelProps {
  medications: Medication[];
  suggestions: Record<number, RestockSuggestion>;
  isLoading: boolean;
  onSelectMedication: (id: number) => void;
}

function formatQuantity(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2
  }).format(value);
}

function formatDaysRemaining(value: number | null): string {
  if (value === null) {
    return "Estimate unavailable";
  }

  if (value === 0) {
    return "0 days";
  }

  return `${formatQuantity(value)} days`;
}

function LowStockPanel({
  medications,
  suggestions,
  isLoading,
  onSelectMedication
}: LowStockPanelProps) {
  const lowStockMedications = medications.filter(
    (medication) => medication.is_low_stock
  );

  return (
    <section className="low-stock-panel" aria-labelledby="low-stock-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Inventory</p>
          <h2 id="low-stock-title">Low Stock</h2>
        </div>
        {isLoading && <span className="muted-label">Checking links</span>}
      </div>

      {lowStockMedications.length === 0 ? (
        <div className="empty-state compact-empty">
          <h3>Stock looks steady</h3>
          <p>No medicines are below their low-stock threshold.</p>
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
                    <StatusBadge tone="danger">Low stock</StatusBadge>
                  </div>
                  <p>
                    {formatQuantity(medication.quantity_remaining)}{" "}
                    {medication.quantity_unit} remaining
                    {medication.low_stock_threshold !== null
                      ? ` / threshold ${formatQuantity(
                          medication.low_stock_threshold
                        )}`
                      : ""}
                  </p>
                  <span>
                    {formatDaysRemaining(medication.days_remaining_estimate)}
                  </span>
                </div>

                <div className="restock-actions">
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    onClick={() => onSelectMedication(medication.id)}
                  >
                    View
                  </button>
                  {suggestion?.links.map((link) => (
                    <a
                      className="restock-link"
                      href={link.url}
                      key={link.label}
                      rel="noreferrer"
                      target="_blank"
                    >
                      {link.label}
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
