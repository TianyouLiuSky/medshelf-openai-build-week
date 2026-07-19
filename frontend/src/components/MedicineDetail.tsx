import LeafletUploadPanel from "./LeafletUploadPanel";
import ScheduleForm from "./ScheduleForm";
import StatusBadge from "./StatusBadge";
import type {
  LeafletUpload,
  Medication,
  RestockSuggestion,
  Schedule,
  SchedulePayload
} from "../types/medicine";

interface MedicineDetailProps {
  medication: Medication | null;
  restockSuggestion?: RestockSuggestion;
  leafletUploads: LeafletUpload[];
  schedules: Schedule[];
  activeLeafletExtractionId: number | null;
  isScheduleSaving: boolean;
  isLeafletLoading: boolean;
  isLeafletUploading: boolean;
  onAddSchedule: (schedule: SchedulePayload) => Promise<void>;
  onCreate: () => void;
  onDelete: (medication: Medication) => void;
  onDeleteSchedule: (schedule: Schedule) => void;
  onEdit: (medication: Medication) => void;
  onExtractLeaflet: (upload: LeafletUpload) => Promise<void>;
  onUploadLeaflet: (file: File) => Promise<void>;
}

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDose(medication: Medication): string {
  if (medication.dose_amount === null || !medication.dose_unit) {
    return "Not recorded";
  }

  return `${medication.dose_amount} ${medication.dose_unit}`;
}

function formatThreshold(medication: Medication): string {
  if (medication.low_stock_threshold === null) {
    return "Not set";
  }

  return `${medication.low_stock_threshold} ${medication.quantity_unit}`;
}

function formatEstimate(value: number | null, unit: string): string {
  if (value === null) {
    return "Not enough schedule data";
  }

  return `${new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 2
  }).format(value)} ${unit}`;
}

function stockBadge(medication: Medication) {
  if (medication.is_low_stock) {
    return <StatusBadge tone="danger">Low stock</StatusBadge>;
  }

  if (medication.low_stock_threshold === null) {
    return <StatusBadge>No threshold</StatusBadge>;
  }

  return <StatusBadge tone="good">In stock</StatusBadge>;
}

function formatScheduleDays(days: number[]): string {
  if (days.length === 7) {
    return "Every day";
  }

  return days.map((day) => dayLabels[day]).join(", ");
}

function formatScheduleRange(schedule: Schedule): string {
  if (!schedule.end_date) {
    return `Starts ${schedule.start_date}`;
  }

  return `${schedule.start_date} to ${schedule.end_date}`;
}

function MedicineDetail({
  medication,
  restockSuggestion,
  leafletUploads,
  schedules,
  activeLeafletExtractionId,
  isScheduleSaving,
  isLeafletLoading,
  isLeafletUploading,
  onAddSchedule,
  onCreate,
  onDelete,
  onDeleteSchedule,
  onEdit,
  onExtractLeaflet,
  onUploadLeaflet
}: MedicineDetailProps) {
  if (!medication) {
    return (
      <section className="detail-panel">
        <div className="empty-state detail-empty">
          <h3>No medicine selected</h3>
          <p>Add a medicine or choose one from the list.</p>
          <button className="primary-button" type="button" onClick={onCreate}>
            Add medicine
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="detail-panel" aria-labelledby="medicine-detail-title">
      <div className="detail-header">
        <div>
          <p className="eyebrow">Medicine detail</p>
          <h2 id="medicine-detail-title">{medication.name}</h2>
          <p className="detail-subtitle">
            {medication.active_ingredients || "Active ingredients not recorded"}
          </p>
        </div>
        {stockBadge(medication)}
      </div>

      <div className="detail-grid">
        <div>
          <span>Form</span>
          <strong>{medication.form || "Not recorded"}</strong>
        </div>
        <div>
          <span>Strength</span>
          <strong>{medication.strength || "Not recorded"}</strong>
        </div>
        <div>
          <span>Remaining</span>
          <strong>
            {medication.quantity_remaining} {medication.quantity_unit}
          </strong>
        </div>
        <div>
          <span>Dose amount</span>
          <strong>{formatDose(medication)}</strong>
        </div>
        <div>
          <span>Low-stock threshold</span>
          <strong>{formatThreshold(medication)}</strong>
        </div>
        <div>
          <span>Daily usage estimate</span>
          <strong>
            {formatEstimate(
              medication.daily_usage_estimate,
              medication.quantity_unit
            )}
          </strong>
        </div>
        <div>
          <span>Days remaining</span>
          <strong>
            {formatEstimate(medication.days_remaining_estimate, "days")}
          </strong>
        </div>
      </div>

      {medication.is_low_stock && restockSuggestion && (
        <div className="restock-panel">
          <div>
            <h3>Restock Links</h3>
            <p>{restockSuggestion.safety_note}</p>
          </div>
          <div className="restock-actions">
            {restockSuggestion.links.map((link) => (
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
        </div>
      )}

      <div className="safety-strip">
        <strong>Follow clinician or pharmacist directions.</strong>
        <span>
          Keep leaflet text separate from user-entered plans until it has been
          explicitly reviewed.
        </span>
      </div>

      <div className="notes-panel">
        <h3>Notes</h3>
        <p>{medication.notes || "No notes recorded."}</p>
      </div>

      <LeafletUploadPanel
        uploads={leafletUploads}
        activeExtractionId={activeLeafletExtractionId}
        isLoading={isLeafletLoading}
        isUploading={isLeafletUploading}
        onExtract={onExtractLeaflet}
        onUpload={onUploadLeaflet}
      />

      <div className="schedule-panel">
        <div className="section-heading">
          <h3>Schedules</h3>
          <span className="muted-label">{schedules.length} active</span>
        </div>

        {schedules.length === 0 ? (
          <div className="empty-state compact-empty">
            <h3>No schedule yet</h3>
            <p>Add times to generate doses on the daily dashboard.</p>
          </div>
        ) : (
          <div className="schedule-list">
            {schedules.map((schedule) => (
              <div className="schedule-row" key={schedule.id}>
                <div>
                  <strong>{schedule.times.join(", ")}</strong>
                  <span>{formatScheduleDays(schedule.days_of_week)}</span>
                  <span>{formatScheduleRange(schedule)}</span>
                </div>
                <button
                  className="text-button danger-text"
                  type="button"
                  onClick={() => onDeleteSchedule(schedule)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}

        <ScheduleForm isSaving={isScheduleSaving} onSubmit={onAddSchedule} />
      </div>

      <div className="detail-actions">
        <button
          className="secondary-button"
          type="button"
          onClick={() => onEdit(medication)}
        >
          Edit
        </button>
        <button
          className="danger-button"
          type="button"
          onClick={() => onDelete(medication)}
        >
          Delete
        </button>
      </div>
    </section>
  );
}

export default MedicineDetail;
