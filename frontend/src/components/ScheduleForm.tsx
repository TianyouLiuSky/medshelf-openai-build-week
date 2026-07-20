import { FormEvent, useState } from "react";

import { useI18n } from "../i18n";
import type { SchedulePayload } from "../types/medicine";

interface ScheduleFormProps {
  isSaving: boolean;
  onSubmit: (schedule: SchedulePayload) => Promise<void>;
}

const days = [
  { label: "Mon", value: 0 },
  { label: "Tue", value: 1 },
  { label: "Wed", value: 2 },
  { label: "Thu", value: 3 },
  { label: "Fri", value: 4 },
  { label: "Sat", value: 5 },
  { label: "Sun", value: 6 }
];

function localDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function ScheduleForm({ isSaving, onSubmit }: ScheduleFormProps) {
  const { t } = useI18n();
  const [times, setTimes] = useState(["08:00"]);
  const [selectedDays, setSelectedDays] = useState(days.map((day) => day.value));
  const [startDate, setStartDate] = useState(localDateValue());
  const [endDate, setEndDate] = useState("");
  const [formError, setFormError] = useState("");

  function updateTime(index: number, value: string) {
    setTimes((current) =>
      current.map((time, currentIndex) =>
        currentIndex === index ? value : time
      )
    );
  }

  function addTime() {
    setTimes((current) => [...current, "20:00"]);
  }

  function removeTime(index: number) {
    setTimes((current) =>
      current.filter((_, currentIndex) => currentIndex !== index)
    );
  }

  function toggleDay(value: number) {
    setSelectedDays((current) =>
      current.includes(value)
        ? current.filter((day) => day !== value)
        : [...current, value].sort((first, second) => first - second)
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const normalizedTimes = Array.from(
      new Set(times.map((time) => time.trim()).filter(Boolean))
    ).sort();

    if (normalizedTimes.length === 0) {
      setFormError(t("Add at least one time."));
      return;
    }

    if (selectedDays.length === 0) {
      setFormError(t("Choose at least one day."));
      return;
    }

    if (!startDate) {
      setFormError(t("Start date is required."));
      return;
    }

    if (endDate && endDate < startDate) {
      setFormError(t("End date cannot be before start date."));
      return;
    }

    await onSubmit({
      times: normalizedTimes,
      days_of_week: selectedDays,
      start_date: startDate,
      end_date: endDate || null
    });

    setTimes(["08:00"]);
    setSelectedDays(days.map((day) => day.value));
    setStartDate(localDateValue());
    setEndDate("");
  }

  return (
    <form className="schedule-form" onSubmit={handleSubmit}>
      <div className="schedule-times">
        <span className="field-label">{t("Dose times")}</span>
        {times.map((time, index) => (
          <div className="time-row" key={index}>
            <input
              type="time"
              value={time}
              onChange={(event) => updateTime(index, event.target.value)}
              required
            />
            {times.length > 1 && (
              <button
                className="text-button danger-text"
                type="button"
                onClick={() => removeTime(index)}
              >
                {t("Remove")}
              </button>
            )}
          </div>
        ))}
        <button
          className="secondary-button compact-button"
          type="button"
          onClick={addTime}
        >
          {t("Add time")}
        </button>
      </div>

      <div>
        <span className="field-label">{t("Days")}</span>
        <div className="day-toggle-grid">
          {days.map((day) => (
            <label className="day-toggle" key={day.value}>
              <input
                type="checkbox"
                checked={selectedDays.includes(day.value)}
                onChange={() => toggleDay(day.value)}
              />
              <span>{t(day.label)}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="form-grid">
        <label>
          <span>{t("Start date")}</span>
          <input
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            required
          />
        </label>
        <label>
          <span>{t("End date")}</span>
          <input
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
          />
        </label>
      </div>

      {formError && <p className="form-error">{formError}</p>}

      <button className="primary-button" type="submit" disabled={isSaving}>
        {isSaving ? t("Saving") : t("Add schedule")}
      </button>
    </form>
  );
}

export default ScheduleForm;
