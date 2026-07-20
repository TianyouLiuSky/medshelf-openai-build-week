import StatusBadge from "./StatusBadge";
import { useI18n } from "../i18n";
import type {
  DoseActionStatus,
  TodayDashboard as TodayDashboardData,
  TodayDose
} from "../types/medicine";

interface TodayDashboardProps {
  dashboard: TodayDashboardData | null;
  isLoading: boolean;
  activeDoseKey: string | null;
  onDoseAction: (dose: TodayDose, status: DoseActionStatus) => Promise<void>;
}

function formatDoseAmount(dose: TodayDose, t: (key: string) => string): string {
  if (dose.dose_amount === null || !dose.dose_unit) {
    return t("Dose amount not recorded");
  }

  return `${dose.dose_amount} ${dose.dose_unit}`;
}

function formatTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function statusTone(status: TodayDose["status"]) {
  if (status === "taken") {
    return "good" as const;
  }
  if (status === "missed") {
    return "danger" as const;
  }
  if (status === "due") {
    return "warning" as const;
  }
  return "neutral" as const;
}

function statusLabel(status: TodayDose["status"], t: (key: string) => string): string {
  return t(status);
}

function TodayDashboard({
  dashboard,
  isLoading,
  activeDoseKey,
  onDoseAction
}: TodayDashboardProps) {
  const { locale, t } = useI18n();

  return (
    <section className="today-panel" aria-labelledby="today-dashboard-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">{t("Today")}</p>
          <h2 id="today-dashboard-title">{t("Dose Dashboard")}</h2>
        </div>
        {isLoading && <span className="muted-label">{t("Loading")}</span>}
      </div>

      {!isLoading && (!dashboard || dashboard.doses.length === 0) && (
        <div className="empty-state compact-empty">
          <h3>{t("No doses scheduled today")}</h3>
          <p>{t("Add schedules to medicines to generate the daily view.")}</p>
        </div>
      )}

      {!isLoading && dashboard && dashboard.doses.length > 0 && (
        <div className="today-dose-list">
          {dashboard.doses.map((dose) => {
            const isBusy = activeDoseKey === dose.dose_key;

            return (
              <article className="today-dose" key={dose.dose_key}>
                <div className="today-dose-time">
                  <strong>{formatTime(dose.scheduled_at, locale)}</strong>
                  <StatusBadge tone={statusTone(dose.status)}>
                    {statusLabel(dose.status, t)}
                  </StatusBadge>
                </div>
                <div className="today-dose-main">
                  <h3>{dose.medication_name}</h3>
                  <p>
                    {dose.strength || dose.form || t("Medicine details pending")} -{" "}
                    {formatDoseAmount(dose, t)}
                  </p>
                  <span>
                    {dose.quantity_remaining} {dose.quantity_unit}{" "}
                    {t("remaining")}
                  </span>
                </div>
                <div className="dose-actions">
                  <button
                    className="primary-button compact-button"
                    type="button"
                    disabled={isBusy || dose.status === "taken"}
                    onClick={() => onDoseAction(dose, "taken")}
                  >
                    {t("Taken")}
                  </button>
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    disabled={isBusy || dose.status === "skipped"}
                    onClick={() => onDoseAction(dose, "skipped")}
                  >
                    {t("Skip")}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

export default TodayDashboard;
