"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Upload,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  CopyCheck,
} from "lucide-react";
import CivicMap from "@/components/CivicMap";
import {
  API_BASE,
  CATEGORIES,
  type AICheckResult,
  type Report,
  type SimilarReportMatch,
} from "@/lib/types";

export default function ReportPage() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [approxCoords, setApproxCoords] = useState<[number, number]>([
    13.0373, 80.2123,
  ]);
  const [userCategory, setUserCategory] = useState<string>("");

  const [aiPreview, setAiPreview] = useState<AICheckResult | null>(null);
  const [similarMatches, setSimilarMatches] = useState<SimilarReportMatch[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submittedReport, setSubmittedReport] = useState<Report | null>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    setError(null);
    setAiPreview(null);
    setSubmittedReport(null);
    if (!file) {
      setPhoto(null);
      setPreviewUrl(null);
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setError("Image file must be under 8 MB.");
      return;
    }
    setPhoto(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  async function runAiPreview() {
    if (!photo) {
      setError("Please select a photograph before running AI check.");
      return;
    }
    setError(null);
    setAnalyzing(true);
    try {
      const form = new FormData();
      form.append("photo", photo);
      form.append("description", description);
      form.append("location_label", locationLabel);
      form.append("approx_lat", String(approxCoords[0]));
      form.append("approx_lng", String(approxCoords[1]));

      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "AI check failed.");
      }
      setAiPreview(data.ai_check);
      setSimilarMatches(data.similar_reports || []);
      if (!userCategory) {
        setUserCategory(data.ai_check.suggested_category);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not run AI check.");
    } finally {
      setAnalyzing(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!photo) {
      setError("Please upload a photograph of the issue.");
      return;
    }
    if (description.trim().length < 5) {
      setError("Please enter a short description (at least 5 characters).");
      return;
    }
    if (locationLabel.trim().length < 3) {
      setError("Please enter an approximate public location or landmark.");
      return;
    }

    setError(null);
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("photo", photo);
      form.append("description", description.trim());
      form.append("location_label", locationLabel.trim());
      form.append("approx_lat", String(approxCoords[0]));
      form.append("approx_lng", String(approxCoords[1]));
      if (userCategory) {
        form.append("user_category", userCategory);
      }

      const res = await fetch(`${API_BASE}/api/reports`, {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || "Submission failed.");
      }
      setSubmittedReport(data.report);
      setAiPreview(data.ai_check);
      setSimilarMatches(data.similar_reports || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit report.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-[#132a46]">Report a Civic Issue</h1>
        <p className="text-sm text-slate-600">
          Submit a photograph, short description, and approximate public location. Do not
          include personal identity details or exact home addresses.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 flex items-center gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {submittedReport && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-5 space-y-3">
          <div className="flex items-center gap-2 text-emerald-900 font-semibold">
            <CheckCircle2 className="w-5 h-5" />
            Report #{submittedReport.id} saved to database (Status: {submittedReport.status})
          </div>
          <p className="text-sm text-emerald-800">
            Category: <strong>{submittedReport.category}</strong> &middot; Illustrative Priority:{" "}
            <strong>
              {submittedReport.priority_band} ({submittedReport.priority_score})
            </strong>
            {submittedReport.needs_human_review && " · Flagged for human review"}
          </p>
          <div className="flex flex-wrap gap-3 pt-1">
            <Link
              href="/explore"
              className="px-4 py-2 rounded-lg bg-[#132a46] text-white text-sm font-medium hover:bg-[#1c3d66]"
            >
              View on Map &amp; Dashboard
            </Link>
            <Link
              href="/review"
              className="px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-800 text-sm font-medium hover:bg-slate-50"
            >
              Open Human Review Queue
            </Link>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-xl border border-slate-200 p-6 space-y-5"
        >
          {/* Photo */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-[#132a46]">
              1. Photograph (JPG, PNG, WEBP)
            </label>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 rounded-xl p-5 cursor-pointer hover:border-[#132a46] transition-colors bg-slate-50">
              {previewUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl}
                  alt="Selected preview"
                  className="max-h-48 rounded-lg object-contain"
                />
              ) : (
                <div className="text-center space-y-1 text-slate-500">
                  <Upload className="w-7 h-7 mx-auto text-slate-400" />
                  <div className="text-sm font-medium text-slate-700">
                    Click to select a photo
                  </div>
                  <div className="text-xs">
                    Avoid faces, vehicle number plates, or private property
                  </div>
                </div>
              )}
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[#132a46]">
              2. Short Description
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Overflowing municipal waste bin near bus stop since morning"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#132a46]"
            />
          </div>

          {/* Approximate Location */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[#132a46]">
              3. Approximate Public Location / Landmark
            </label>
            <input
              type="text"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              placeholder="e.g., Ashok Pillar Bus Stop / 10th Avenue Corner"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#132a46]"
            />
            <p className="text-xs text-slate-500">
              Selected map coordinates (rounded for privacy):{" "}
              <span className="font-mono">
                {approxCoords[0].toFixed(4)}, {approxCoords[1].toFixed(4)}
              </span>
            </p>
          </div>

          {/* Category override */}
          <div className="space-y-1.5">
            <label className="block text-sm font-semibold text-[#132a46]">
              4. Category (AI Suggestion or Your Correction)
            </label>
            <select
              value={userCategory}
              onChange={(e) => setUserCategory(e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#132a46]"
            >
              <option value="">Let AI suggest automatically</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              type="button"
              onClick={runAiPreview}
              disabled={analyzing || !photo}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-[#132a46] text-[#132a46] text-sm font-semibold hover:bg-slate-50 disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4" />
              {analyzing ? "Checking..." : "Run AI Check Preview"}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#132a46] text-white text-sm font-semibold hover:bg-[#1c3d66] disabled:opacity-50"
            >
              {submitting ? "Submitting..." : "Submit Report"}
            </button>
          </div>
        </form>

        {/* Right column: Map Picker + AI Check Results */}
        <div className="space-y-5">
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold text-[#132a46] text-sm">
                <MapPin className="w-4 h-4" />
                Click Map to Set Approximate Public Location
              </div>
              <span className="text-[11px] text-slate-500">OpenStreetMap</span>
            </div>
            <CivicMap
              center={approxCoords}
              selectedPosition={approxCoords}
              onSelectPosition={(lat, lng) => setApproxCoords([lat, lng])}
              heightClass="h-64"
            />
          </div>

          {/* AI Check Output */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-[#132a46] text-sm">
                AI Check &amp; Duplicate Suggestions
              </h2>
              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                Assistive Only
              </span>
            </div>

            {!aiPreview ? (
              <p className="text-sm text-slate-500">
                Upload a photo and click <strong>Run AI Check Preview</strong> (or submit) to
                see the suggested category, confidence score, and possible duplicate reports.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-[#eef6f5] border border-teal-200 p-3.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-teal-900">
                      AI Suggested Category
                    </span>
                    <span className="text-xs font-mono font-semibold text-teal-900">
                      Confidence: {Math.round(aiPreview.confidence * 100)}%
                    </span>
                  </div>
                  <div className="text-base font-bold text-[#132a46]">
                    {aiPreview.suggested_category}
                  </div>
                  <div className="w-full h-2 rounded-full bg-white overflow-hidden border border-teal-200">
                    <div
                      className="h-full bg-[#132a46]"
                      style={{ width: `${Math.round(aiPreview.confidence * 100)}%` }}
                    />
                  </div>
                  {aiPreview.needs_human_review && (
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-100 px-2.5 py-1 rounded">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Needs human review
                    </div>
                  )}
                  <p className="text-xs text-slate-600">{aiPreview.analysis_notes}</p>
                  <p className="text-[11px] text-slate-500">
                    Method: {aiPreview.model_type}
                  </p>

                  {typeof aiPreview.privacy_faces_blurred === "number" &&
                    aiPreview.privacy_faces_blurred > 0 && (
                      <div className="text-[11px] text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1">
                        Privacy filter: blurred {aiPreview.privacy_faces_blurred} detected face(s).
                      </div>
                    )}

                  {aiPreview.class_probabilities && (
                    <div className="pt-2 border-t border-teal-200/70 space-y-1.5">
                      <div className="text-[11px] font-semibold text-teal-900">
                        Category Probability Breakdown
                      </div>
                      {Object.entries(aiPreview.class_probabilities)
                        .sort((a, b) => b[1] - a[1])
                        .map(([cat, prob]) => (
                          <div key={cat} className="space-y-0.5 text-[11px]">
                            <div className="flex justify-between text-slate-700">
                              <span>{cat}</span>
                              <span className="font-mono">{Math.round(prob * 100)}%</span>
                            </div>
                            <div className="w-full h-1.5 bg-white rounded-full overflow-hidden">
                              <div
                                className="h-full bg-teal-700"
                                style={{ width: `${Math.round(prob * 100)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                    </div>
                  )}

                  {aiPreview.visual_features && (
                    <div className="pt-2 border-t border-teal-200/70 grid grid-cols-3 gap-2 text-[11px] text-slate-600">
                      <div>
                        Brightness:{" "}
                        <strong className="font-mono">
                          {Math.round((aiPreview.visual_features.brightness ?? 0) * 100)}%
                        </strong>
                      </div>
                      <div>
                        Edge Density:{" "}
                        <strong className="font-mono">
                          {Math.round((aiPreview.visual_features.edge_density ?? 0) * 100)}%
                        </strong>
                      </div>
                      <div>
                        Sharpness:{" "}
                        <strong className="font-mono">
                          {aiPreview.visual_features.blur_variance ?? 0}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
                    <CopyCheck className="w-4 h-4 text-[#132a46]" />
                    Possible Similar Reports (Never Auto-Merged)
                  </div>
                  {similarMatches.length === 0 ? (
                    <p className="text-xs text-slate-500">
                      No similar earlier reports found.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {similarMatches.map((m) => (
                        <div
                          key={m.report_id}
                          className="rounded-lg border border-slate-200 p-3 text-xs space-y-1 bg-slate-50"
                        >
                          <div className="flex items-center justify-between font-semibold text-[#132a46]">
                            <span>
                              Report #{m.report_id} &middot; {m.category}
                            </span>
                            <span className="text-sky-700">
                              {Math.round(m.similarity_score * 100)}% match
                            </span>
                          </div>
                          <div className="text-slate-600">{m.description}</div>
                          <div className="text-slate-500">
                            {m.location_label}
                            {typeof m.distance_meters === "number" &&
                              ` (~${m.distance_meters}m away)`}{" "}
                            &middot; Status: {m.status}{" "}
                            {m.is_sample ? "· [Sample]" : "· [Live]"}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
