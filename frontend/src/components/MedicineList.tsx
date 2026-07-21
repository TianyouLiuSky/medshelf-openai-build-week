import StatusBadge from "./StatusBadge";
import { useI18n } from "../i18n";
import type { Medication } from "../types/medicine";

interface MedicineListProps {
  medications: Medication[];
  selectedMedicationId: number | null;
  onSelect: (id: number) => void;
}

function formatDaysRemaining(
  medication: Medication,
  formatNumber: (value: number) => string,
  t: (key: string) => string
): string {
  if (!medication.is_routine) {
    return t("Storage tracking only");
  }

  if (medication.days_remaining_estimate === null) {
    return t("Days remaining unavailable");
  }

  return `${formatNumber(medication.days_remaining_estimate)} ${t(
    "days remaining"
  )}`;
}

function medicineStatus(medication: Medication, t: (key: string) => string) {
  if (medication.is_low_stock) {
    return { label: t("Low stock"), tone: "danger" as const };
  }

  if (medication.low_stock_threshold === null) {
    return { label: t("No threshold"), tone: "neutral" as const };
  }

  return { label: t("In stock"), tone: "good" as const };
}

function MedicineList({
  medications,
  selectedMedicationId,
  onSelect
}: MedicineListProps) {
  const { formatNumber, t } = useI18n();

  if (medications.length === 0) {
    return (
      <div className="empty-state">
        <h3>{t("No medicines yet")}</h3>
        <p>{t("Add a medicine or load the demo set to begin.")}</p>
      </div>
    );
  }

  return (
    <ul className="medicine-list">
      {medications.map((medication) => {
        const status = medicineStatus(medication, t);
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
                {medication.strength || medication.form || t("Details pending")}
              </span>
              <span className="medicine-list-stock">
                {formatNumber(medication.quantity_remaining)}{" "}
                {medication.quantity_unit} {t("left")}
              </span>
              <span className="medicine-list-days">
                {formatDaysRemaining(medication, formatNumber, t)}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default MedicineList;
