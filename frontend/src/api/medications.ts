import type {
  DoseActionStatus,
  LeafletExtraction,
  LeafletGuidance,
  LeafletGuidanceApprovalPayload,
  LeafletUpload,
  Medication,
  MedicationPayload,
  RestockSuggestion,
  Schedule,
  SchedulePayload,
  TodayDashboard
} from "../types/medicine";

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";
const API_BASE_URL = configuredBaseUrl.replace(/\/$/, "");

interface DemoSeedResponse {
  medications: Medication[];
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });

  if (!response.ok) {
    let message = response.statusText || "Request failed";

    try {
      const error = (await response.json()) as { detail?: string };
      if (error.detail) {
        message = error.detail;
      }
    } catch {
      message = "Request failed";
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function listMedications(): Promise<Medication[]> {
  return request<Medication[]>("/api/medications");
}

export function createMedication(
  medication: MedicationPayload
): Promise<Medication> {
  return request<Medication>("/api/medications", {
    method: "POST",
    body: JSON.stringify(medication)
  });
}

export function updateMedication(
  id: number,
  medication: MedicationPayload
): Promise<Medication> {
  return request<Medication>(`/api/medications/${id}`, {
    method: "PATCH",
    body: JSON.stringify(medication)
  });
}

export function deleteMedication(id: number): Promise<void> {
  return request<void>(`/api/medications/${id}`, {
    method: "DELETE"
  });
}

export function seedDemoMedications(): Promise<Medication[]> {
  return request<DemoSeedResponse>("/api/demo/seed", {
    method: "POST"
  }).then((response) => response.medications);
}

export function listSchedules(medicationId: number): Promise<Schedule[]> {
  return request<Schedule[]>(`/api/medications/${medicationId}/schedules`);
}

export function createSchedule(
  medicationId: number,
  schedule: SchedulePayload
): Promise<Schedule> {
  return request<Schedule>(`/api/medications/${medicationId}/schedules`, {
    method: "POST",
    body: JSON.stringify(schedule)
  });
}

export function deleteSchedule(id: number): Promise<void> {
  return request<void>(`/api/schedules/${id}`, {
    method: "DELETE"
  });
}

export function getTodayDashboard(date: string): Promise<TodayDashboard> {
  return request<TodayDashboard>(`/api/dashboard/today?date=${date}`);
}

export function recordDoseAction(
  medicationId: number,
  scheduleId: number,
  scheduledAt: string,
  status: DoseActionStatus
): Promise<void> {
  return request<void>(`/api/medications/${medicationId}/doses`, {
    method: "POST",
    body: JSON.stringify({
      schedule_id: scheduleId,
      scheduled_at: scheduledAt,
      status
    })
  });
}

export function getRestockSuggestion(
  medicationId: number,
  region = ""
): Promise<RestockSuggestion> {
  const params = new URLSearchParams({ medication_id: String(medicationId) });
  if (region.trim()) {
    params.set("region", region.trim());
  }

  return request<RestockSuggestion>(`/api/restock/suggestions?${params}`);
}

export function listLeafletUploads(medicationId: number): Promise<LeafletUpload[]> {
  return request<LeafletUpload[]>(`/api/medications/${medicationId}/leaflets`);
}

export function uploadLeaflet(
  medicationId: number,
  file: File
): Promise<LeafletUpload> {
  return request<LeafletUpload>(`/api/medications/${medicationId}/leaflet`, {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "X-Leaflet-Filename": encodeURIComponent(file.name)
    },
    body: file
  });
}

export function extractLeaflet(leafletId: number): Promise<LeafletExtraction> {
  return request<LeafletExtraction>(`/api/leaflets/${leafletId}/extract`, {
    method: "POST"
  });
}

export function getLatestLeafletExtraction(
  leafletId: number
): Promise<LeafletExtraction> {
  return request<LeafletExtraction>(`/api/leaflets/${leafletId}/extraction`);
}

export function listLeafletGuidance(
  medicationId: number
): Promise<LeafletGuidance[]> {
  return request<LeafletGuidance[]>(
    `/api/medications/${medicationId}/leaflet-guidance`
  );
}

export function approveLeafletExtraction(
  leafletId: number,
  guidance: LeafletGuidanceApprovalPayload
): Promise<LeafletGuidance> {
  return request<LeafletGuidance>(`/api/leaflets/${leafletId}/approve`, {
    method: "POST",
    body: JSON.stringify(guidance)
  });
}
