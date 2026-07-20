import ApprovedGuidancePanel from "./ApprovedGuidancePanel";
import LeafletUploadPanel from "./LeafletUploadPanel";
import LeafletReviewPanel from "./LeafletReviewPanel";
import ScheduleForm from "./ScheduleForm";
import StatusBadge from "./StatusBadge";
import { useI18n } from "../i18n";
import type {
  LeafletExtraction,
  LeafletGuidance,
  LeafletGuidancePayload,
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
  leafletGuidance: LeafletGuidance[];
  selectedLeafletExtraction: LeafletExtraction | null;
  schedules: Schedule[];
  activeLeafletExtractionId: number | null;
  activeLeafletReviewId: number | null;
  isLeafletApproving: boolean;
  isLeafletGuidanceLoading: boolean;
  isScheduleSaving: boolean;
  isLeafletLoading: boolean;
  isLeafletReviewLoading: boolean;
  isLeafletUploading: boolean;
  onAddSchedule: (schedule: SchedulePayload) => Promise<void>;
  onCreate: () => void;
  onDelete: (medication: Medication) => void;
  onDeleteSchedule: (schedule: Schedule) => void;
  onEdit: (medication: Medication) => void;
  onApproveLeafletGuidance: (
    extraction: LeafletExtraction,
    guidance: LeafletGuidancePayload
  ) => Promise<void>;
  onCloseLeafletReview: () => void;
  onExtractLeaflet: (upload: LeafletUpload) => Promise<void>;
  onReviewLeaflet: (upload: LeafletUpload) => Promise<void>;
  onUploadLeaflet: (file: File) => Promise<void>;
}

const dayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function formatDose(medication: Medication, t: (key: string) => string): string {
  if (medication.dose_amount === null || !medication.dose_unit) {
    return t("Not recorded");
  }

  return `${medication.dose_amount} ${medication.dose_unit}`;
}

function formatThreshold(
  medication: Medication,
  t: (key: string) => string
): string {
  if (medication.low_stock_threshold === null) {
    return t("Not set");
  }

  return `${medication.low_stock_threshold} ${medication.quantity_unit}`;
}

function formatEstimate(
  value: number | null,
  unit: string,
  formatNumber: (value: number) => string,
  t: (key: string) => string
): string {
  if (value === null) {
    return t("Not enough schedule data");
  }

  return `${formatNumber(value)} ${unit}`;
}

function stockBadge(medication: Medication, t: (key: string) => string) {
  if (medication.is_low_stock) {
    return <StatusBadge tone="danger">{t("Low stock")}</StatusBadge>;
  }

  if (medication.low_stock_threshold === null) {
    return <StatusBadge>{t("No threshold")}</StatusBadge>;
  }

  return <StatusBadge tone="good">{t("In stock")}</StatusBadge>;
}

function formatScheduleDays(days: number[], t: (key: string) => string): string {
  if (days.length === 7) {
    return t("Every day");
  }

  return days.map((day) => t(dayLabels[day])).join(", ");
}

function formatScheduleRange(schedule: Schedule, t: (key: string) => string): string {
  if (!schedule.end_date) {
    return `${t("Starts")} ${schedule.start_date}`;
  }

  return `${schedule.start_date} ${t("to")} ${schedule.end_date}`;
}

function MedicineDetail({
  medication,
  restockSuggestion,
  leafletUploads,
  leafletGuidance,
  selectedLeafletExtraction,
  schedules,
  activeLeafletExtractionId,
  activeLeafletReviewId,
  isLeafletApproving,
  isLeafletGuidanceLoading,
  isScheduleSaving,
  isLeafletLoading,
  isLeafletReviewLoading,
  isLeafletUploading,
  onAddSchedule,
  onCreate,
  onDelete,
  onDeleteSchedule,
  onEdit,
  onApproveLeafletGuidance,
  onCloseLeafletReview,
  onExtractLeaflet,
  onReviewLeaflet,
  onUploadLeaflet
}: MedicineDetailProps) {
  const { formatNumber, t } = useI18n();

  if (!medication) {
    return (
      <section className="detail-panel">
        <div className="empty-state detail-empty">
          <h3>{t("No medicine selected")}</h3>
          <p>{t("Add a medicine or choose one from the list.")}</p>
          <button className="primary-button" type="button" onClick={onCreate}>
            {t("Add medicine")}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="detail-panel" aria-labelledby="medicine-detail-title">
      <div className="detail-header">
        <div>
          <p className="eyebrow">{t("Medicine detail")}</p>
          <h2 id="medicine-detail-title">{medication.name}</h2>
          <p className="detail-subtitle">
            {medication.active_ingredients ||
              t("Active ingredients not recorded")}
          </p>
        </div>
        {stockBadge(medication, t)}
      </div>

      <div className="detail-grid">
        <div>
          <span>{t("Form")}</span>
          <strong>{medication.form || t("Not recorded")}</strong>
        </div>
        <div>
          <span>{t("Strength")}</span>
          <strong>{medication.strength || t("Not recorded")}</strong>
        </div>
        <div>
          <span>{t("Remaining")}</span>
          <strong>
            {medication.quantity_remaining} {medication.quantity_unit}
          </strong>
        </div>
        <div>
          <span>{t("Dose amount")}</span>
          <strong>{formatDose(medication, t)}</strong>
        </div>
        <div>
          <span>{t("Low-stock threshold")}</span>
          <strong>{formatThreshold(medication, t)}</strong>
        </div>
        <div>
          <span>{t("Daily usage estimate")}</span>
          <strong>
            {formatEstimate(
              medication.daily_usage_estimate,
              medication.quantity_unit,
              formatNumber,
              t
            )}
          </strong>
        </div>
        <div>
          <span>{t("Days remaining")}</span>
          <strong>
            {formatEstimate(
              medication.days_remaining_estimate,
              t("days"),
              formatNumber,
              t
            )}
          </strong>
        </div>
      </div>

      {medication.is_low_stock && restockSuggestion && (
        <div className="restock-panel">
          <div>
            <h3>{t("Restock Links")}</h3>
            <p>
              {t(
                "Use these links to find restock options, then confirm availability, substitution, and dosing questions with a pharmacist or clinician."
              )}
            </p>
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
                {t(link.label)}
              </a>
            ))}
          </div>
        </div>
      )}

      <div className="safety-strip">
        <strong>{t("Follow clinician or pharmacist directions.")}</strong>
        <span>
          {t(
            "Keep leaflet text separate from user-entered plans until it has been explicitly reviewed."
          )}
        </span>
      </div>

      <div className="notes-panel">
        <h3>{t("Notes")}</h3>
        <p>{medication.notes || t("No notes recorded.")}</p>
      </div>

      <ApprovedGuidancePanel
        guidance={leafletGuidance}
        isLoading={isLeafletGuidanceLoading}
      />

      <LeafletUploadPanel
        uploads={leafletUploads}
        activeExtractionId={activeLeafletExtractionId}
        activeReviewId={activeLeafletReviewId}
        isLoading={isLeafletLoading}
        isUploading={isLeafletUploading}
        onExtract={onExtractLeaflet}
        onReview={onReviewLeaflet}
        onUpload={onUploadLeaflet}
      />

      <LeafletReviewPanel
        extraction={selectedLeafletExtraction}
        isLoading={isLeafletReviewLoading}
        isApproving={isLeafletApproving}
        onApprove={onApproveLeafletGuidance}
        onCancel={onCloseLeafletReview}
      />

      <div className="schedule-panel">
        <div className="section-heading">
          <h3>{t("Schedules")}</h3>
          <span className="muted-label">
            {schedules.length} {t("active")}
          </span>
        </div>

        {schedules.length === 0 ? (
          <div className="empty-state compact-empty">
            <h3>{t("No schedule yet")}</h3>
            <p>{t("Add times to generate doses on the daily dashboard.")}</p>
          </div>
        ) : (
          <div className="schedule-list">
            {schedules.map((schedule) => (
              <div className="schedule-row" key={schedule.id}>
                <div>
                  <strong>{schedule.times.join(", ")}</strong>
                  <span>{formatScheduleDays(schedule.days_of_week, t)}</span>
                  <span>{formatScheduleRange(schedule, t)}</span>
                </div>
                <button
                  className="text-button danger-text"
                  type="button"
                  onClick={() => onDeleteSchedule(schedule)}
                >
                  {t("Delete")}
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
          {t("Edit")}
        </button>
        <button
          className="danger-button"
          type="button"
          onClick={() => onDelete(medication)}
        >
          {t("Delete")}
        </button>
      </div>
    </section>
  );
}

export default MedicineDetail;
