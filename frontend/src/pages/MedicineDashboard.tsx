import { useEffect, useMemo, useState } from "react";

import {
  createSchedule,
  createMedication,
  deleteSchedule as deleteScheduleRequest,
  deleteMedication,
  extractLeaflet,
  getRestockSuggestion,
  getTodayDashboard,
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
import type {
  DoseActionStatus,
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

function localDateValue(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function MedicineDashboard() {
  const [medications, setMedications] = useState<Medication[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [todayDashboard, setTodayDashboard] =
    useState<TodayDashboardData | null>(null);
  const [restockSuggestions, setRestockSuggestions] = useState<
    Record<number, RestockSuggestion>
  >({});
  const [leafletUploads, setLeafletUploads] = useState<LeafletUpload[]>([]);
  const [selectedMedicationId, setSelectedMedicationId] = useState<number | null>(
    null
  );
  const [mode, setMode] = useState<WorkspaceMode>("detail");
  const [isLoading, setIsLoading] = useState(true);
  const [isDashboardLoading, setIsDashboardLoading] = useState(true);
  const [isRestockLoading, setIsRestockLoading] = useState(false);
  const [isLeafletLoading, setIsLeafletLoading] = useState(false);
  const [isLeafletUploading, setIsLeafletUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isScheduleSaving, setIsScheduleSaving] = useState(false);
  const [activeDoseKey, setActiveDoseKey] = useState<string | null>(null);
  const [activeLeafletExtractionId, setActiveLeafletExtractionId] = useState<
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
          : "Could not load medicines."
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
          : "Could not load schedules."
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
          : "Could not load leaflets."
      );
    } finally {
      setIsLeafletLoading(false);
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
          : "Could not load today's dashboard."
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
      return;
    }

    void loadSchedulesForMedication(selectedMedicationId);
    void loadLeafletsForMedication(selectedMedicationId);
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
              : "Could not load restock links."
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
          : "Could not save medicine."
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
          : "Could not update medicine."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDelete(medication: Medication) {
    const confirmed = window.confirm(`Delete ${medication.name}?`);
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
          : "Could not delete medicine."
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
          : "Could not load demo data."
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
          : "Could not save schedule."
      );
    } finally {
      setIsScheduleSaving(false);
    }
  }

  async function handleDeleteSchedule(schedule: Schedule) {
    const confirmed = window.confirm("Delete this schedule?");
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
          : "Could not delete schedule."
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
          : "Could not update dose."
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
      await loadLeafletsForMedication(selectedMedication.id);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not upload leaflet."
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
        setError(extraction.error_message || "Leaflet extraction failed.");
      }
      await loadLeafletsForMedication(upload.medication_id);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not extract leaflet."
      );
    } finally {
      setActiveLeafletExtractionId(null);
    }
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">MedShelf</p>
          <h1>Medicine Tracker</h1>
        </div>
        <div className="header-actions">
          <button
            className="secondary-button"
            type="button"
            onClick={handleSeedDemo}
          >
            Load demo data
          </button>
          <button
            className="primary-button"
            type="button"
            onClick={() => setMode("new")}
          >
            Add medicine
          </button>
        </div>
      </header>

      <section className="safety-banner" role="note">
        <strong>Informational support only.</strong>
        <span>
          Keep prescriptions, labels, and pharmacist guidance as the source of
          truth.
        </span>
      </section>

      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button
            className="text-button"
            type="button"
            onClick={() => void loadMedicines()}
          >
            Retry
          </button>
        </div>
      )}

      <section className="summary-grid" aria-label="Medicine summary">
        <div className="summary-item">
          <span>Total medicines</span>
          <strong>{medications.length}</strong>
        </div>
        <div className="summary-item">
          <span>Low stock</span>
          <strong>{lowStockCount}</strong>
        </div>
        <div className="summary-item">
          <span>Today's doses</span>
          <strong>{todayDoseCount}</strong>
        </div>
        <div className="summary-item">
          <span>Missed</span>
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
            <h2 id="medicine-list-title">Medicines</h2>
            {isLoading && <span className="muted-label">Loading</span>}
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
              <h2 id="form-title">Add Medicine</h2>
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
              <h2 id="form-title">Edit Medicine</h2>
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
            schedules={schedules}
            activeLeafletExtractionId={activeLeafletExtractionId}
            isScheduleSaving={isScheduleSaving}
            isLeafletLoading={isLeafletLoading}
            isLeafletUploading={isLeafletUploading}
            onAddSchedule={handleAddSchedule}
            onCreate={() => setMode("new")}
            onDelete={handleDelete}
            onDeleteSchedule={handleDeleteSchedule}
            onEdit={(medication) => {
              setSelectedMedicationId(medication.id);
              setMode("edit");
            }}
            onExtractLeaflet={handleExtractLeaflet}
            onUploadLeaflet={handleUploadLeaflet}
          />
        )}
      </section>
    </main>
  );
}

export default MedicineDashboard;
