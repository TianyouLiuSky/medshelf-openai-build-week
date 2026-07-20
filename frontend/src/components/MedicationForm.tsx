import { FormEvent, useMemo, useState } from "react";

import { useI18n } from "../i18n";
import type { Medication, MedicationPayload } from "../types/medicine";

interface MedicationFormProps {
  medication?: Medication;
  isSaving: boolean;
  onCancel: () => void;
  onSubmit: (medication: MedicationPayload) => Promise<void>;
}

interface FormState {
  name: string;
  active_ingredients: string;
  form: string;
  strength: string;
  quantity_remaining: string;
  quantity_unit: string;
  dose_amount: string;
  dose_unit: string;
  low_stock_threshold: string;
  notes: string;
}

const emptyForm: FormState = {
  name: "",
  active_ingredients: "",
  form: "",
  strength: "",
  quantity_remaining: "0",
  quantity_unit: "tablets",
  dose_amount: "",
  dose_unit: "",
  low_stock_threshold: "",
  notes: ""
};

function toFormState(medication?: Medication): FormState {
  if (!medication) {
    return emptyForm;
  }

  return {
    name: medication.name,
    active_ingredients: medication.active_ingredients,
    form: medication.form,
    strength: medication.strength,
    quantity_remaining: String(medication.quantity_remaining),
    quantity_unit: medication.quantity_unit,
    dose_amount:
      medication.dose_amount === null ? "" : String(medication.dose_amount),
    dose_unit: medication.dose_unit,
    low_stock_threshold:
      medication.low_stock_threshold === null
        ? ""
        : String(medication.low_stock_threshold),
    notes: medication.notes
  };
}

function toRequiredNumber(value: string): number {
  return Number(value.trim() || "0");
}

function toOptionalNumber(value: string): number | null {
  const normalized = value.trim();
  return normalized ? Number(normalized) : null;
}

function MedicationForm({
  medication,
  isSaving,
  onCancel,
  onSubmit
}: MedicationFormProps) {
  const { t } = useI18n();
  const initialState = useMemo(() => toFormState(medication), [medication]);
  const [form, setForm] = useState<FormState>(initialState);
  const [formError, setFormError] = useState("");

  function updateField(field: keyof FormState, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!form.name.trim()) {
      setFormError(t("Medicine name is required."));
      return;
    }

    if (!form.quantity_unit.trim()) {
      setFormError(t("Quantity unit is required."));
      return;
    }

    const quantityRemaining = toRequiredNumber(form.quantity_remaining);
    const doseAmount = toOptionalNumber(form.dose_amount);
    const lowStockThreshold = toOptionalNumber(form.low_stock_threshold);

    if (
      Number.isNaN(quantityRemaining) ||
      Number.isNaN(doseAmount ?? 0) ||
      Number.isNaN(lowStockThreshold ?? 0)
    ) {
      setFormError(t("Quantity, dose amount, and threshold must be numbers."));
      return;
    }

    await onSubmit({
      name: form.name.trim(),
      active_ingredients: form.active_ingredients.trim(),
      form: form.form.trim(),
      strength: form.strength.trim(),
      quantity_remaining: quantityRemaining,
      quantity_unit: form.quantity_unit.trim(),
      dose_amount: doseAmount,
      dose_unit: form.dose_unit.trim(),
      low_stock_threshold: lowStockThreshold,
      notes: form.notes.trim()
    });
  }

  return (
    <form className="medicine-form" onSubmit={handleSubmit}>
      <div className="form-grid">
        <label>
          <span>{t("Name")}</span>
          <input
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            required
          />
        </label>

        <label>
          <span>{t("Active ingredients")}</span>
          <input
            value={form.active_ingredients}
            onChange={(event) =>
              updateField("active_ingredients", event.target.value)
            }
          />
        </label>

        <label>
          <span>{t("Form")}</span>
          <input
            value={form.form}
            onChange={(event) => updateField("form", event.target.value)}
            placeholder={t("tablet, capsule, inhaler")}
          />
        </label>

        <label>
          <span>{t("Strength")}</span>
          <input
            value={form.strength}
            onChange={(event) => updateField("strength", event.target.value)}
            placeholder="10 mg"
          />
        </label>

        <label>
          <span>{t("Quantity remaining")}</span>
          <input
            min="0"
            step="0.01"
            type="number"
            value={form.quantity_remaining}
            onChange={(event) =>
              updateField("quantity_remaining", event.target.value)
            }
            required
          />
        </label>

        <label>
          <span>{t("Quantity unit")}</span>
          <input
            value={form.quantity_unit}
            onChange={(event) =>
              updateField("quantity_unit", event.target.value)
            }
            required
          />
        </label>

        <label>
          <span>{t("Dose amount")}</span>
          <input
            min="0"
            step="0.01"
            type="number"
            value={form.dose_amount}
            onChange={(event) => updateField("dose_amount", event.target.value)}
          />
        </label>

        <label>
          <span>{t("Dose unit")}</span>
          <input
            value={form.dose_unit}
            onChange={(event) => updateField("dose_unit", event.target.value)}
            placeholder={t("tablet")}
          />
        </label>

        <label>
          <span>{t("Low-stock threshold")}</span>
          <input
            min="0"
            step="0.01"
            type="number"
            value={form.low_stock_threshold}
            onChange={(event) =>
              updateField("low_stock_threshold", event.target.value)
            }
          />
        </label>
      </div>

      <label className="notes-field">
        <span>{t("Notes")}</span>
        <textarea
          value={form.notes}
          onChange={(event) => updateField("notes", event.target.value)}
          rows={4}
        />
      </label>

      {formError && <p className="form-error">{formError}</p>}

      <div className="form-actions">
        <button className="secondary-button" type="button" onClick={onCancel}>
          {t("Cancel")}
        </button>
        <button className="primary-button" type="submit" disabled={isSaving}>
          {isSaving ? t("Saving") : t("Save medicine")}
        </button>
      </div>
    </form>
  );
}

export default MedicationForm;
