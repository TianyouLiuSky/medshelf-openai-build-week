export interface Medication {
  id: number;
  name: string;
  active_ingredients: string;
  form: string;
  strength: string;
  quantity_remaining: number;
  quantity_unit: string;
  dose_amount: number | null;
  dose_unit: string;
  low_stock_threshold: number | null;
  notes: string;
  is_low_stock: boolean;
  daily_usage_estimate: number | null;
  days_remaining_estimate: number | null;
  created_at: string;
  updated_at: string;
}

export interface MedicationPayload {
  name: string;
  active_ingredients: string;
  form: string;
  strength: string;
  quantity_remaining: number;
  quantity_unit: string;
  dose_amount: number | null;
  dose_unit: string;
  low_stock_threshold: number | null;
  notes: string;
}

export interface Schedule {
  id: number;
  medication_id: number;
  times: string[];
  days_of_week: number[];
  start_date: string;
  end_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface SchedulePayload {
  times: string[];
  days_of_week: number[];
  start_date: string;
  end_date: string | null;
}

export type DoseStatus = "due" | "missed" | "taken" | "skipped";
export type DoseActionStatus = "taken" | "skipped";

export interface TodayDose {
  dose_key: string;
  medication_id: number;
  medication_name: string;
  form: string;
  strength: string;
  quantity_remaining: number;
  quantity_unit: string;
  dose_amount: number | null;
  dose_unit: string;
  schedule_id: number;
  scheduled_at: string;
  status: DoseStatus;
  logged_at: string | null;
  quantity_delta: number | null;
}

export interface TodayDashboard {
  date: string;
  generated_at: string;
  doses: TodayDose[];
}

export interface RestockLink {
  label: string;
  url: string;
}

export interface RestockSuggestion {
  medication_id: number;
  medication_name: string;
  is_low_stock: boolean;
  quantity_remaining: number;
  quantity_unit: string;
  low_stock_threshold: number | null;
  daily_usage_estimate: number | null;
  days_remaining_estimate: number | null;
  search_query: string;
  links: RestockLink[];
  safety_note: string;
}

export type LeafletExtractionStatus =
  | "uploaded"
  | "queued"
  | "extracting"
  | "needs_review"
  | "failed"
  | "approved";

export interface LeafletUpload {
  id: number;
  medication_id: number;
  original_filename: string;
  stored_filename: string;
  content_type: string;
  size_bytes: number;
  status: LeafletExtractionStatus;
  created_at: string;
  updated_at: string;
}
