import StatusBadge from "./StatusBadge";
import type { Medication } from "../types/medicine";

interface MedicineListProps {
  medications: Medication[];
  selectedMedicationId: number | null;
  onSelect: (id: number) => void;
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2
  }).format(value);
}

function formatQuantity(medication: Medication): string {
  return formatNumber(medication.quantity_remaining);
}

function formatDaysRemaining(medication: Medication): string {
  if (medication.days_remaining_estimate === null) {
    return "Days remaining unavailable";
  }

  return `${formatNumber(medication.days_remaining_estimate)} days remaining`;
}

function medicineStatus(medication: Medication) {
  if (medication.is_low_stock) {
    return { label: "Low stock", tone: "danger" as const };
  }

  if (medication.low_stock_threshold === null) {
    return { label: "No threshold", tone: "neutral" as const };
  }

  return { label: "In stock", tone: "good" as const };
}

function MedicineList({
  medications,
  selectedMedicationId,
  onSelect
}: MedicineListProps) {
  if (medications.length === 0) {
    return (
      <div className="empty-state">
        <h3>No medicines yet</h3>
        <p>Add a medicine or load the demo set to begin.</p>
      </div>
    );
  }

  return (
    <ul className="medicine-list">
      {medications.map((medication) => {
        const status = medicineStatus(medication);
        const isSelected = medication.id === selectedMedicationId;

        return (
          <li className="medicine-list-item" key={medication.id}>
            <button
              className={`medicine-select${isSelected ? " is-selected" : ""}`}
              type="button"
              onClick={() => onSelect(medication.id)}
            >
              <span className="medicine-list-topline">
                <strong>{medication.name}</strong>
                <StatusBadge tone={status.tone}>{status.label}</StatusBadge>
              </span>
              <span className="medicine-list-meta">
                {medication.strength || medication.form || "Details pending"}
              </span>
              <span className="medicine-list-stock">
                {formatQuantity(medication)} {medication.quantity_unit} left
              </span>
              <span className="medicine-list-days">
                {formatDaysRemaining(medication)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default MedicineList;
