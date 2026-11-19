"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { UserCheck, AlertTriangle, CheckCircle2, CopyCheck } from "lucide-react";
import {
  API_BASE,
  CATEGORIES,
  STATUSES,
  imageUrl,
  priorityBadgeClass,
  statusBadgeClass,
  type Report,
  type SimilarReportMatch,
} from "@/lib/types";

function computePriorityClient(s: number, i: number, r: number, t: number) {
  const score = Number((0.35 * s + 0.3 * i + 0.2 * r + 0.15 * t).toFixed(1));
  let band = "LOW";
  if (score >= 80) band = "CRITICAL";
  else if (score >= 60) band = "HIGH";
  else if (score >= 30) band = "MEDIUM";
  return { score, band };
}

export default function ReviewQueuePage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [similar, setSimilar] = useState<SimilarReportMatch[]>([]);

  // Editable review fields
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [status, setStatus] = useState<string>(STATUSES[0]);
  const [needsReview, setNeedsReview] = useState<boolean>(true);
  const [duplicateOfId, setDuplicateOfId] = useState<number | null>(null);
  const [sVal, setSVal] = useState(50);
  const [iVal, setIVal] = useState(50);
  const [rVal, setRVal] = useState(30);
  const [tVal, setTVal] = useState(20);
  const [reviewerNote, setReviewerNote] = useState("");

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadReports = useCallback(async () => {
    setError(null);
    try {
      const qs = onlyNeedsReview ? "?needs_review=true" : "";
      const res = await fetch(`${API_BASE}/api/reports${qs}`);
      if (!res.ok) throw new Error("Failed to fetch reports.");
      const data = await res.json();
      const list: Report[] = data.reports || [];
      setReports(list);

      const urlParams = new URLSearchParams(window.location.search);
      const queryId = Number(urlParams.get("id"));
      if (queryId && list.some((item) => item.id === queryId)) {
        setSelectedId(queryId);
      } else if (list.length > 0 && !list.some((item) => item.id === selectedId)) {
        setSelectedId(list[0].id);
      } else if (list.length === 0) {
        setSelectedId(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backend unavailable.");
    }
  }, [onlyNeedsReview, selectedId]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const selectedReport = useMemo(
    () => reports.find((r) => r.id === selectedId) ?? null,
    [reports, selectedId]
  );

  useEffect(() => {
    if (!selectedReport) {
      setSimilar([]);
      return;
    }
    setCategory(selectedReport.category);
    setStatus(selectedReport.status);
    setNeedsReview(selectedReport.needs_human_review);
    setDuplicateOfId(selectedReport.duplicate_of_id);
    setSVal(selectedReport.severity_s);
    setIVal(selectedReport.impact_i);
    setRVal(selectedReport.recurrence_r);
    setTVal(selectedReport.time_t);
    setReviewerNote("");
    setMessage(null);

    fetch(`${API_BASE}/api/reports/${selectedReport.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.similar_reports) setSimilar(data.similar_reports);
      })
      .catch(() => setSimilar([]));
  }, [selectedReport]);

  const livePriority = computePriorityClient(sVal, iVal, rVal, tVal);

  async function saveReview(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedReport) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch(`${API_BASE}/api/reports/${selectedReport.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category,
          status,
          needs_human_review: needsReview,
          duplicate_of_id: duplicateOfId,
          clear_duplicate: duplicateOfId === null,
          severity_s: sVal,
          impact_i: iVal,
          recurrence_r: rVal,
          time_t: tVal,
          reviewer_note: reviewerNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Could not save review.");

      setMessage(`Saved human review for Report #${selectedReport.id}.`);
      await loadReports();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save review.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#132a46] flex items-center gap-2">
            <UserCheck className="w-6 h-6 text-[#132a46]" />
            Human Review &amp; Priority Queue
          </h1>
          <p className="text-sm text-slate-600">
            Verify AI suggestions, confirm or reject possible duplicates, and review
            illustrative priority scores.
          </p>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700 bg-white border border-slate-200 px-3 py-2 rounded-lg cursor-pointer">
          <input
            type="checkbox"
            checked={onlyNeedsReview}
            onChange={(e) => setOnlyNeedsReview(e.target.checked)}
          />
          Only &ldquo;Needs Human Review&rdquo;
        </label>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {message && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{message}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Queue List */}
        <div className="lg:col-span-5 space-y-2.5">
          {reports.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-6 text-sm text-slate-500 text-center">
              No reports in this queue view.
            </div>
          ) : (
            reports.map((r) => {
              const active = r.id === selectedId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedId(r.id)}
                  className={`w-full text-left rounded-xl border p-3.5 transition-colors space-y-1.5 ${
                    active
                      ? "bg-[#eef6f5] border-[#132a46] ring-1 ring-[#132a46]"
                      : "bg-white border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="font-bold text-sm text-[#132a46]">
                      #{r.id} &middot; {r.category}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${priorityBadgeClass(
                        r.priority_band
                      )}`}
                    >
                      {r.priority_band} ({r.priority_score})
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2">{r.description}</p>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className={`px-2 py-0.5 rounded ${statusBadgeClass(r.status)}`}>
                      {r.status}
                    </span>
                    {r.needs_human_review && (
                      <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-semibold">
                        Needs Review
                      </span>
                    )}
                    <span className="text-slate-400">
                      {r.is_sample ? "Sample" : "Live"}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Review Editor */}
        <div className="lg:col-span-7">
          {!selectedReport ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              Select a report from the queue to review.
            </div>
          ) : (
            <form
              onSubmit={saveReview}
              className="bg-white rounded-xl border border-slate-200 p-6 space-y-5"
            >
              <div className="flex flex-col sm:flex-row gap-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(selectedReport.image_path)}
                  alt={selectedReport.category}
                  className="w-full sm:w-44 h-36 object-cover rounded-lg border border-slate-200 bg-slate-100"
                />
                <div className="space-y-1.5 flex-1">
                  <div className="text-xs font-semibold text-slate-500">
                    Report #{selectedReport.id} &middot;{" "}
                    {selectedReport.is_sample ? "Sample Record" : "Live Submission"}
                  </div>
                  <p className="text-sm font-medium text-[#132a46]">
                    {selectedReport.description}
                  </p>
                  <p className="text-xs text-slate-600">
                    Location: {selectedReport.location_label}
                  </p>
                  <div className="text-xs bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-700">
                    <strong>AI Suggestion:</strong> {selectedReport.ai_suggested_category} (
                    {Math.round(selectedReport.ai_confidence * 100)}% confidence)
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      {selectedReport.ai_notes}
                    </div>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#132a46]">
                    Verified Category
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-xs font-semibold text-[#132a46]">
                    Workflow Status
                  </label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={needsReview}
                  onChange={(e) => setNeedsReview(e.target.checked)}
                />
                Keep flagged as &ldquo;Needs human review&rdquo;
              </label>

              {/* Similar / Duplicate Check */}
              <div className="border-t border-slate-200 pt-4 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#132a46]">
                    <CopyCheck className="w-4 h-4" />
                    Duplicate Check (Human Confirmation Required)
                  </div>
                  {duplicateOfId !== null && (
                    <button
                      type="button"
                      onClick={() => setDuplicateOfId(null)}
                      className="text-xs text-rose-700 hover:underline"
                    >
                      Clear duplicate link (#{duplicateOfId})
                    </button>
                  )}
                </div>

                {similar.length === 0 ? (
                  <p className="text-xs text-slate-500">
                    No similar reports suggested by text similarity.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {similar.map((m) => (
                      <div
                        key={m.report_id}
                        className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 p-2.5 text-xs bg-slate-50"
                      >
                        <div>
                          <div className="font-semibold text-[#132a46]">
                            Report #{m.report_id} ({Math.round(m.similarity_score * 100)}%
                            similar)
                          </div>
                          <div className="text-slate-600">{m.description}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setDuplicateOfId(m.report_id)}
                          className={`px-2.5 py-1 rounded text-xs font-semibold shrink-0 ${
                            duplicateOfId === m.report_id
                              ? "bg-[#132a46] text-white"
                              : "bg-white border border-slate-300 text-slate-700 hover:bg-slate-100"
                          }`}
                        >
                          {duplicateOfId === m.report_id ? "Linked" : "Confirm Duplicate"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Transparent Priority Formula */}
              <div className="border-t border-slate-200 pt-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="text-xs font-semibold text-[#132a46]">
                      Illustrative Attention Score: P = 0.35S + 0.30I + 0.20R + 0.15T
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Illustrative bands only — does not automatically dispatch workers.
                    </div>
                  </div>
                  <span
                    className={`text-xs font-bold px-2.5 py-1 rounded border ${priorityBadgeClass(
                      livePriority.band
                    )}`}
                  >
                    {livePriority.band} &middot; {livePriority.score}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="space-y-1">
                    <div className="flex justify-between">
                      <span>Severity (S)</span>
                      <span className="font-mono font-semibold">{sVal}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={sVal}
                      onChange={(e) => setSVal(Number(e.target.value))}
                      className="w-full"
                    />
                  </label>
                  <label className="space-y-1">
                    <div className="flex justify-between">
                      <span>Public Impact (I)</span>
                      <span className="font-mono font-semibold">{iVal}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={iVal}
                      onChange={(e) => setIVal(Number(e.target.value))}
                      className="w-full"
                    />
                  </label>
                  <label className="space-y-1">
                    <div className="flex justify-between">
                      <span>Recurrence (R)</span>
                      <span className="font-mono font-semibold">{rVal}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={rVal}
                      onChange={(e) => setRVal(Number(e.target.value))}
                      className="w-full"
                    />
                  </label>
                  <label className="space-y-1">
                    <div className="flex justify-between">
                      <span>Time Unresolved (T)</span>
                      <span className="font-mono font-semibold">{tVal}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={tVal}
                      onChange={(e) => setTVal(Number(e.target.value))}
                      className="w-full"
                    />
                  </label>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-semibold text-[#132a46]">
                  Reviewer Note (Optional)
                </label>
                <input
                  type="text"
                  value={reviewerNote}
                  onChange={(e) => setReviewerNote(e.target.value)}
                  placeholder="e.g., Confirmed category from photo; marked Verified"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-lg bg-[#132a46] text-white text-sm font-semibold hover:bg-[#1c3d66] disabled:opacity-50"
              >
                {saving ? "Saving Review..." : "Save Human Review"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
