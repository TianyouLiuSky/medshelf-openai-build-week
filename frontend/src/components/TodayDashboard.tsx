import StatusBadge from "./StatusBadge";
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

function formatDoseAmount(dose: TodayDose): string {
  if (dose.dose_amount === null || !dose.dose_unit) {
    return "Dose amount not recorded";
  }

  return `${dose.dose_amount} ${dose.dose_unit}`;
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
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

function statusLabel(status: TodayDose["status"]): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function TodayDashboard({
  dashboard,
  isLoading,
  activeDoseKey,
  onDoseAction
}: TodayDashboardProps) {
  return (
    <section className="today-panel" aria-labelledby="today-dashboard-title">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Today</p>
          <h2 id="today-dashboard-title">Dose Dashboard</h2>
        </div>
        {isLoading && <span className="muted-label">Loading</span>}
      </div>

      {!isLoading && (!dashboard || dashboard.doses.length === 0) && (
        <div className="empty-state compact-empty">
          <h3>No doses scheduled today</h3>
          <p>Add schedules to medicines to generate the daily view.</p>
        </div>
      )}

      {!isLoading && dashboard && dashboard.doses.length > 0 && (
        <div className="today-dose-list">
          {dashboard.doses.map((dose) => {
            const isBusy = activeDoseKey === dose.dose_key;

            return (
              <article className="today-dose" key={dose.dose_key}>
                <div className="today-dose-time">
                  <strong>{formatTime(dose.scheduled_at)}</strong>
                  <StatusBadge tone={statusTone(dose.status)}>
                    {statusLabel(dose.status)}
                  </StatusBadge>
                </div>
                <div className="today-dose-main">
                  <h3>{dose.medication_name}</h3>
                  <p>
                    {dose.strength || dose.form || "Medicine details pending"} -{" "}
                    {formatDoseAmount(dose)}
                  </p>
                  <span>
                    {dose.quantity_remaining} {dose.quantity_unit} remaining
                  </span>
                </div>
                <div className="dose-actions">
                  <button
                    className="primary-button compact-button"
                    type="button"
                    disabled={isBusy || dose.status === "taken"}
                    onClick={() => onDoseAction(dose, "taken")}
                  >
                    Taken
                  </button>
                  <button
                    className="secondary-button compact-button"
                    type="button"
                    disabled={isBusy || dose.status === "skipped"}
                    onClick={() => onDoseAction(dose, "skipped")}
                  >
                    Skip
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
