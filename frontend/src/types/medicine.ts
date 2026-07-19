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

export type LeafletExtractionProvider = "mock" | "local_ocr" | "openai";
export type LeafletConfidence = "high" | "medium" | "low";
export type LeafletWarningSeverity = "info" | "caution" | "urgent";

export interface MedicineNameExtraction {
  value: string | null;
  source_snippet: string | null;
  confidence: LeafletConfidence;
}

export interface ActiveIngredientExtraction {
  name: string;
  strength: string | null;
  source_snippet: string;
  confidence: LeafletConfidence;
}

export interface UsageInstructionExtraction {
  instruction: string;
  source_snippet: string;
  confidence: LeafletConfidence;
}

export interface WarningExtraction {
  warning: string;
  severity: LeafletWarningSeverity;
  source_snippet: string;
  confidence: LeafletConfidence;
}

export interface TextClaimExtraction {
  text: string;
  source_snippet: string;
  confidence: LeafletConfidence;
}

export interface LeafletGuidancePayload {
  medicine_name: MedicineNameExtraction;
  active_ingredients: ActiveIngredientExtraction[];
  usage_instructions: UsageInstructionExtraction[];
  warnings: WarningExtraction[];
  contraindications: TextClaimExtraction[];
  side_effects: TextClaimExtraction[];
  storage: TextClaimExtraction[];
  plain_language_summary: string;
  translated_summary: string;
  review_notes: string[];
}

export interface LeafletParsedOutput extends LeafletGuidancePayload {
  needs_review: true;
}

export interface LeafletApprovedGuidance extends LeafletGuidancePayload {
  needs_review: false;
}

export interface LeafletExtraction {
  id: number;
  leaflet_upload_id: number;
  medication_id: number;
  provider: LeafletExtractionProvider;
  status: LeafletExtractionStatus;
  source_text: string;
  raw_model_output: string;
  parsed_output: LeafletParsedOutput | null;
  error_message: string;
  created_at: string;
  updated_at: string;
}

export interface LeafletGuidance {
  id: number;
  medication_id: number;
  leaflet_upload_id: number;
  leaflet_extraction_id: number;
  guidance: LeafletApprovedGuidance;
  created_at: string;
  updated_at: string;
}

export interface LeafletGuidanceApprovalPayload extends LeafletGuidancePayload {
  extraction_id: number;
}
