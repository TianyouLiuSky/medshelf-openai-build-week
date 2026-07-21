import { useEffect, useMemo, useState } from "react";

import {
  approveLeafletExtraction,
  createSchedule,
  createMedication,
  deleteSchedule as deleteScheduleRequest,
  deleteMedication,
  extractLeaflet,
  extractLeafletFromBrowserOcr,
  getLatestLeafletExtraction,
  getRestockSuggestion,
  getTodayDashboard,
  listLeafletGuidance,
  listLeafletUploads,
  listMedications,
  listSchedules,
  recordDoseAction,
  seedDemoMedications,
  updateMedication,
  uploadLeaflet
} from "../api/medications";
import MedicineDetail from "../components/MedicineDetail";
import MedicationForm from "../components/MedicationForm";
import MedicineList from "../components/MedicineList";
import LowStockPanel from "../components/LowStockPanel";
import StatusBadge from "../components/StatusBadge";
import TodayDashboardPanel from "../components/TodayDashboard";
import { useI18n, type Language } from "../i18n";
import type { ThemeMode } from "../App";
import type {
  DoseActionStatus,
  LeafletExtraction,
  LeafletGuidance,
  LeafletGuidancePayload,
  LeafletUpload,
  Medication,
  MedicationPayload,
  RestockSuggestion,
  Schedule,
  SchedulePayload,
  TodayDashboard as TodayDashboardData,
  TodayDose
} from "../types/medicine";

type WorkspaceMode = "detail" | "new" | "edit";

interface MedicineDashboardProps {
  language: Language;
  themeMode: ThemeMode;
  onLanguageChange: (language: Language) => void;
  onThemeModeChange: (themeMode: ThemeMode) => void;
}

function localDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function MedicineDashboard({
  language,
  themeMode,
  onLanguageChange,
  onThemeModeChange
}: MedicineDashboardProps) {
  const { t } = useI18n();
  const [medications, setMedications] = useState<Medication[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [todayDashboard, setTodayDashboard] =
    useState<TodayDashboardData | null>(null);
  const [restockSuggestions, setRestockSuggestions] = useState<
    Record<number, RestockSuggestion>
  >({});
  const [leafletUploads, setLeafletUploads] = useState<LeafletUpload[]>([]);
  const [leafletGuidance, setLeafletGuidance] = useState<LeafletGuidance[]>([]);
  const [selectedLeafletExtraction, setSelectedLeafletExtraction] =
    useState<LeafletExtraction | null>(null);
  const [selectedMedicationId, setSelectedMedicationId] = useState<number | null>(
    null
  );
  const [mode, setMode] = useState<WorkspaceMode>("detail");
  const [isLoading, setIsLoading] = useState(true);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [isRestockLoading, setIsRestockLoading] = useState(false);
  const [isLeafletGuidanceLoading, setIsLeafletGuidanceLoading] =
    useState(false);
  const [isLeafletLoading, setIsLeafletLoading] = useState(false);
  const [isLeafletReviewLoading, setIsLeafletReviewLoading] = useState(false);
  const [isLeafletUploading, setIsLeafletUploading] = useState(false);
  const [isLeafletApproving, setIsLeafletApproving] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isScheduleSaving, setIsScheduleSaving] = useState(false);
  const [activeDoseKey, setActiveDoseKey] = useState<string | null>(null);
  const [activeLeafletExtractionId, setActiveLeafletExtractionId] = useState<
    number | null
  >(null);
  const [activeLeafletReviewId, setActiveLeafletReviewId] = useState<
    number | null
  >(null);
  const [error, setError] = useState("");

  const selectedMedication = useMemo(
    () =>
      medications.find((medication) => medication.id === selectedMedicationId) ??
      null,
    [medications, selectedMedicationId]
  );

  const lowStockCount = medications.filter(
    (medication) => medication.is_low_stock
  ).length;
  const todayDoseCount = todayDashboard?.doses.length ?? 0;
  const missedDoseCount =
    todayDashboard?.doses.filter((dose) => dose.status === "missed").length ?? 0;

  async function loadMedicines(preferredMedicationId?: number) {
    setError("");
    setIsLoading(true);

    try {
      const loadedMedications = await listMedications();
      setMedications(loadedMedications);
      setSelectedMedicationId((currentId) => {
        const preferredExists = loadedMedications.some(
          (medication) => medication.id === preferredMedicationId
        );
        if (preferredMedicationId && preferredExists) {
          return preferredMedicationId;
        }

        const currentExists = loadedMedications.some(
          (medication) => medication.id === currentId
        );
        if (currentId && currentExists) {
          return currentId;
        }

        return loadedMedications[0]?.id ?? null;
      });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not load medicines.")
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function loadSchedulesForMedication(medicationId: number) {
    try {
      const loadedSchedules = await listSchedules(medicationId);
      setSchedules(loadedSchedules);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not load schedules.")
      );
    }
  }

  async function loadLeafletsForMedication(medicationId: number) {
    setIsLeafletLoading(true);

    try {
      const uploads = await listLeafletUploads(medicationId);
      setLeafletUploads(uploads);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not load leaflets.")
      );
    } finally {
      setIsLeafletLoading(false);
    }
  }

  async function loadLeafletGuidanceForMedication(medicationId: number) {
    setIsLeafletGuidanceLoading(true);

    try {
      const guidance = await listLeafletGuidance(medicationId);
      setLeafletGuidance(guidance);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not load reviewed leaflet guidance.")
      );
    } finally {
      setIsLeafletGuidanceLoading(false);
    }
  }

  async function loadTodayDashboard() {
    setIsDashboardLoading(true);

    try {
      const dashboard = await getTodayDashboard(localDateValue());
      setTodayDashboard(dashboard);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not load today's dashboard.")
      );
    } finally {
      setIsDashboardLoading(false);
    }
  }

  useEffect(() => {
    void loadMedicines();
    void loadTodayDashboard();
  }, []);

  useEffect(() => {
    if (selectedMedicationId === null) {
      setSchedules([]);
      setLeafletUploads([]);
      setLeafletGuidance([]);
      setSelectedLeafletExtraction(null);
      return;
    }

    void loadSchedulesForMedication(selectedMedicationId);
    void loadLeafletsForMedication(selectedMedicationId);
    void loadLeafletGuidanceForMedication(selectedMedicationId);
  }, [selectedMedicationId]);

  useEffect(() => {
    const lowStockMedications = medications.filter(
      (medication) => medication.is_low_stock
    );

    if (lowStockMedications.length === 0) {
      setRestockSuggestions({});
      setIsRestockLoading(false);
      return;
    }

    let isCancelled = false;
    setIsRestockLoading(true);

    async function loadRestockSuggestions() {
      try {
        const suggestions = await Promise.all(
          lowStockMedications.map((medication) =>
            getRestockSuggestion(medication.id)
          )
        );

        if (!isCancelled) {
          setRestockSuggestions(
            Object.fromEntries(
              suggestions.map((suggestion) => [
                suggestion.medication_id,
                suggestion
              ])
            )
          );
        }
      } catch (caughtError) {
        if (!isCancelled) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : t("Could not load restock links.")
          );
        }
      } finally {
        if (!isCancelled) {
          setIsRestockLoading(false);
        }
      }
    }

    void loadRestockSuggestions();

    return () => {
      isCancelled = true;
    };
  }, [medications]);

  async function handleCreate(payload: MedicationPayload) {
    setIsSaving(true);
    setError("");

    try {
      const created = await createMedication(payload);
      await loadMedicines(created.id);
      await loadTodayDashboard();
      setMode("detail");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not save medicine.")
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdate(payload: MedicationPayload) {
    if (!selectedMedication) {
      return;
    }

    setIsSaving(true);
    setError("");

    try {
      const updated = await updateMedication(selectedMedication.id, payload);
      await loadMedicines(updated.id);
      await loadTodayDashboard();
      setMode("detail");
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not update medicine.")
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(medication: Medication) {
    const confirmed = window.confirm(`${t("Delete")} ${medication.name}?`);
    if (!confirmed) {
      return;
    }

    setError("");

    try {
      await deleteMedication(medication.id);
      setSelectedMedicationId(null);
      setMode("detail");
      await loadMedicines();
      await loadTodayDashboard();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not delete medicine.")
      );
    }
  }

  async function handleSeedDemo() {
    setError("");
    setIsLoading(true);

    try {
      const seededMedications = await seedDemoMedications();
      setMedications(seededMedications);
      setSelectedMedicationId(seededMedications[0]?.id ?? null);
      setMode("detail");
      await loadTodayDashboard();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not load demo data.")
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function handleAddSchedule(payload: SchedulePayload) {
    if (!selectedMedication) {
      return;
    }

    setError("");
    setIsScheduleSaving(true);

    try {
      await createSchedule(selectedMedication.id, payload);
      await loadSchedulesForMedication(selectedMedication.id);
      await loadTodayDashboard();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not save schedule.")
      );
    } finally {
      setIsScheduleSaving(false);
    }
  }

  async function handleDeleteSchedule(schedule: Schedule) {
    const confirmed = window.confirm(t("Delete this schedule?"));
    if (!confirmed) {
      return;
    }

    setError("");

    try {
      await deleteScheduleRequest(schedule.id);
      await loadSchedulesForMedication(schedule.medication_id);
      await loadTodayDashboard();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not delete schedule.")
      );
    }
  }

  async function handleDoseAction(dose: TodayDose, status: DoseActionStatus) {
    setError("");
    setActiveDoseKey(dose.dose_key);

    try {
      await recordDoseAction(
        dose.medication_id,
        dose.schedule_id,
        dose.scheduled_at,
        status
      );
      await loadMedicines(dose.medication_id);
      await loadTodayDashboard();
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not update dose.")
      );
    } finally {
      setActiveDoseKey(null);
    }
  }

  async function handleUploadLeaflet(file: File) {
    if (!selectedMedication) {
      return;
    }

    setError("");
    setIsLeafletUploading(true);

    try {
      await uploadLeaflet(selectedMedication.id, file);
      setSelectedLeafletExtraction(null);
      await loadLeafletsForMedication(selectedMedication.id);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not upload leaflet.")
      );
      throw caughtError;
    } finally {
      setIsLeafletUploading(false);
    }
  }

  async function handleUploadLeafletWithOcrText(file: File, sourceText: string) {
    if (!selectedMedication) {
      return;
    }

    setError("");
    setIsLeafletUploading(true);

    try {
      const upload = await uploadLeaflet(selectedMedication.id, file);
      const extraction = await extractLeafletFromBrowserOcr(upload.id, sourceText);
      if (extraction.status === "failed") {
        setError(extraction.error_message || t("Leaflet extraction failed."));
        setSelectedLeafletExtraction(null);
      } else if (extraction.status === "needs_review") {
        setSelectedLeafletExtraction(extraction);
      }
      await loadLeafletsForMedication(selectedMedication.id);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not upload leaflet.")
      );
      throw caughtError;
    } finally {
      setIsLeafletUploading(false);
    }
  }

  async function handleExtractLeaflet(upload: LeafletUpload) {
    setError("");
    setActiveLeafletExtractionId(upload.id);

    try {
      const extraction = await extractLeaflet(upload.id);
      if (extraction.status === "failed") {
        setError(extraction.error_message || t("Leaflet extraction failed."));
      } else if (extraction.status === "needs_review") {
        setSelectedLeafletExtraction(extraction);
      }
      await loadLeafletsForMedication(upload.medication_id);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not extract leaflet.")
      );
    } finally {
      setActiveLeafletExtractionId(null);
    }
  }

  async function handleReviewLeaflet(upload: LeafletUpload) {
    setError("");
    setActiveLeafletReviewId(upload.id);
    setIsLeafletReviewLoading(true);

    try {
      const extraction = await getLatestLeafletExtraction(upload.id);
      if (extraction.status !== "needs_review" || !extraction.parsed_output) {
        setError(t("This leaflet does not have reviewable extraction output."));
        setSelectedLeafletExtraction(null);
        return;
      }
      setSelectedLeafletExtraction(extraction);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not open leaflet review.")
      );
    } finally {
      setActiveLeafletReviewId(null);
      setIsLeafletReviewLoading(false);
    }
  }

  async function handleApproveLeafletGuidance(
    extraction: LeafletExtraction,
    guidance: LeafletGuidancePayload
  ) {
    setError("");
    setIsLeafletApproving(true);

    try {
      await approveLeafletExtraction(extraction.leaflet_upload_id, {
        extraction_id: extraction.id,
        ...guidance
      });
      setSelectedLeafletExtraction(null);
      await loadLeafletsForMedication(extraction.medication_id);
      await loadLeafletGuidanceForMedication(extraction.medication_id);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : t("Could not approve leaflet guidance.")
      );
    } finally {
      setIsLeafletApproving(false);
    }
  }

  async function handleRetryLoad() {
    setError("");
    await loadMedicines(selectedMedicationId ?? undefined);
    await loadTodayDashboard();
    if (selectedMedicationId !== null) {
      await loadSchedulesForMedication(selectedMedicationId);
      await loadLeafletsForMedication(selectedMedicationId);
      await loadLeafletGuidanceForMedication(selectedMedicationId);
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">MedShelf</p>
          <h1>{t("Medicine Tracker")}</h1>
        </div>
        <div className="header-actions">
          <div className="preference-controls" aria-label={t("Display preferences")}>
            <label className="theme-toggle">
              <input
                type="checkbox"
                checked={themeMode === "dark"}
                onChange={(event) =>
                  onThemeModeChange(event.target.checked ? "dark" : "light")
                }
              />
              <span>{themeMode === "dark" ? t("Night mode") : t("Day mode")}</span>
            </label>
            <label className="language-select">
              <span>{t("Language")}</span>
              <select
                value={language}
                onChange={(event) =>
                  onLanguageChange(event.target.value as Language)
                }
              >
                <option value="en">{t("English")}</option>
                <option value="zh">{t("Chinese")}</option>
              </select>
            </label>
          </div>
          <button
            className="secondary-button"
            type="button"
            onClick={handleSeedDemo}
          >
            {t("Load demo data")}
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => setMode("new")}
          >
            {t("Add medicine")}
          </button>
        </div>
      </header>

      <section className="safety-banner" role="note">
        <strong>{t("Informational support only.")}</strong>
        <span>
          {t(
            "Keep prescriptions, labels, and pharmacist guidance as the source of truth. The default demo uses mock extraction and local upload storage."
          )}
        </span>
      </section>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button
            className="text-button"
            type="button"
            onClick={() => void handleRetryLoad()}
          >
            {t("Retry")}
          </button>
        </div>
      )}

      <section className="summary-grid" aria-label="Medicine summary">
        <div className="summary-item">
          <span>{t("Total medicines")}</span>
          <strong>{medications.length}</strong>
        </div>
        <div className="summary-item">
          <span>{t("Low stock")}</span>
          <strong>{lowStockCount}</strong>
        </div>
        <div className="summary-item">
          <span>{t("Today's doses")}</span>
          <strong>{todayDoseCount}</strong>
        </div>
        <div className="summary-item">
          <span>{t("Missed")}</span>
          <strong>
            {missedDoseCount > 0 ? (
              <StatusBadge tone="danger">{String(missedDoseCount)}</StatusBadge>
            ) : (
              "0"
            )}
          </strong>
        </div>
      </section>

      <TodayDashboardPanel
        dashboard={todayDashboard}
        isLoading={isDashboardLoading}
        activeDoseKey={activeDoseKey}
        onDoseAction={handleDoseAction}
      />

      <LowStockPanel
        medications={medications}
        suggestions={restockSuggestions}
        isLoading={isRestockLoading}
        onSelectMedication={(id) => {
          setSelectedMedicationId(id);
          setMode("detail");
        }}
      />

      <section className="workspace-grid">
        <aside className="list-panel" aria-labelledby="medicine-list-title">
          <div className="section-heading">
            <h2 id="medicine-list-title">{t("Medicines")}</h2>
            {isLoading && <span className="muted-label">{t("Loading")}</span>}
          </div>
          {!isLoading && (
            <MedicineList
              medications={medications}
              selectedMedicationId={selectedMedicationId}
              onSelect={(id) => {
                setSelectedMedicationId(id);
                setMode("detail");
              }}
            />
          )}
        </aside>

        {mode === "new" && (
          <section className="form-panel" aria-labelledby="form-title">
            <div className="section-heading">
              <h2 id="form-title">{t("Add Medicine")}</h2>
            </div>
            <MedicationForm
              isSaving={isSaving}
              onCancel={() => setMode("detail")}
              onSubmit={handleCreate}
            />
          </section>
        )}

        {mode === "edit" && selectedMedication && (
          <section className="form-panel" aria-labelledby="form-title">
            <div className="section-heading">
              <h2 id="form-title">{t("Edit Medicine")}</h2>
            </div>
            <MedicationForm
              medication={selectedMedication}
              isSaving={isSaving}
              onCancel={() => setMode("detail")}
              onSubmit={handleUpdate}
            />
          </section>
        )}

        {mode === "detail" && (
          <MedicineDetail
            medication={selectedMedication}
            restockSuggestion={
              selectedMedication
                ? restockSuggestions[selectedMedication.id]
                : undefined
            }
            leafletUploads={leafletUploads}
            leafletGuidance={leafletGuidance}
            selectedLeafletExtraction={selectedLeafletExtraction}
            schedules={schedules}
            activeLeafletExtractionId={activeLeafletExtractionId}
            activeLeafletReviewId={activeLeafletReviewId}
            isLeafletApproving={isLeafletApproving}
            isLeafletGuidanceLoading={isLeafletGuidanceLoading}
            isScheduleSaving={isScheduleSaving}
            isLeafletLoading={isLeafletLoading}
            isLeafletReviewLoading={isLeafletReviewLoading}
            isLeafletUploading={isLeafletUploading}
            onAddSchedule={handleAddSchedule}
            onCreate={() => setMode("new")}
            onDelete={handleDelete}
            onDeleteSchedule={handleDeleteSchedule}
            onEdit={(medication) => {
              setSelectedMedicationId(medication.id);
              setMode("edit");
            }}
            onApproveLeafletGuidance={handleApproveLeafletGuidance}
            onCloseLeafletReview={() => setSelectedLeafletExtraction(null)}
            onExtractLeaflet={handleExtractLeaflet}
            onReviewLeaflet={handleReviewLeaflet}
            onUploadLeaflet={handleUploadLeaflet}
            onUploadLeafletWithOcrText={handleUploadLeafletWithOcrText}
          />
        )}
      </section>
    </main>
  );
}

export default MedicineDashboard;
