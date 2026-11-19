export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export const CATEGORIES = [
  "Overflowing garbage bin",
  "Water leakage",
  "Damaged footpath / road",
  "Streetlight problem",
  "Other / Not sure",
] as const;

export const STATUSES = [
  "Submitted",
  "Under Review",
  "Verified",
  "In Progress",
  "Resolved",
] as const;

export interface Report {
  id: number;
  description: string;
  location_label: string;
  approx_lat: number;
  approx_lng: number;
  image_path: string;
  category: string;
  ai_suggested_category: string;
  ai_confidence: number;
  ai_notes: string;
  needs_human_review: boolean;
  status: string;
  duplicate_of_id: number | null;
  severity_s: number;
  impact_i: number;
  recurrence_r: number;
  time_t: number;
  priority_score: number;
  priority_band: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
  is_sample: boolean;
  created_at: string;
  updated_at: string;
}

export interface SimilarReportMatch {
  report_id: number;
  description: string;
  category: string;
  location_label: string;
  status: string;
  is_sample: boolean;
  similarity_score: number;
  text_similarity?: number;
  distance_meters?: number | null;
}

export interface AICheckResult {
  suggested_category: string;
  confidence: number;
  needs_human_review: boolean;
  class_probabilities?: Record<string, number>;
  visual_features?: Record<string, number>;
  privacy_faces_blurred?: number;
  analysis_notes: string;
  model_type: string;
}

export interface AIEvaluationReport {
  model_name: string;
  dataset_note: string;
  train_samples: number;
  test_samples: number;
  verified_feedback_samples: number;
  test_accuracy: number;
  categories: string[];
  per_category_metrics: Record<
    string,
    { precision: number; recall: number; f1: number }
  >;
  confusion_matrix: number[][];
  trained_at: string;
}

export interface StatsResponse {
  total_reports: number;
  sample_count: number;
  live_count: number;
  needs_human_review_count: number;
  category_counts: Record<string, number>;
  status_counts: Record<string, number>;
  priority_counts: Record<string, number>;
}

export function imageUrl(path: string): string {
  if (!path) return "";
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path}`;
}

export function priorityBadgeClass(band: string): string {
  switch (band) {
    case "CRITICAL":
      return "bg-rose-100 text-rose-800 border-rose-300";
    case "HIGH":
      return "bg-orange-100 text-orange-800 border-orange-300";
    case "MEDIUM":
      return "bg-amber-100 text-amber-800 border-amber-300";
    default:
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
  }
}

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "Resolved":
      return "bg-emerald-100 text-emerald-800";
    case "In Progress":
      return "bg-sky-100 text-sky-800";
    case "Verified":
      return "bg-teal-100 text-teal-800";
    case "Under Review":
      return "bg-amber-100 text-amber-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}
