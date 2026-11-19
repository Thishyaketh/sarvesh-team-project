"use client";

import { useEffect, useState } from "react";
import { Cpu, RefreshCw, AlertTriangle, CheckCircle2, BarChart3 } from "lucide-react";
import { API_BASE, type AIEvaluationReport } from "@/lib/types";

export default function AILabPage() {
  const [evalData, setEvalData] = useState<AIEvaluationReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [retraining, setRetraining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function fetchEvaluation() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/evaluation`);
      if (!res.ok) throw new Error("Failed to load AI evaluation metrics.");
      const data: AIEvaluationReport = await res.json();
      setEvalData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Backend unavailable.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchEvaluation();
  }, []);

  async function handleRetrain() {
    setRetraining(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_BASE}/api/ai/retrain`, { method: "POST" });
      if (!res.ok) throw new Error("Retraining failed.");
      const data: AIEvaluationReport = await res.json();
      setEvalData(data);
      setNotice(
        `Model retrained with ${data.verified_feedback_samples} verified live report(s).`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not retrain model.");
    } finally {
      setRetraining(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#132a46] flex items-center gap-2">
            <Cpu className="w-6 h-6" />
            AI Model Lab &amp; Evaluation
          </h1>
          <p className="text-sm text-slate-600">
            OpenCV 10-feature extraction + scikit-learn RandomForestClassifier &amp;
            TF-IDF NLP similarity.
          </p>
        </div>
        <button
          type="button"
          onClick={handleRetrain}
          disabled={retraining || loading}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#132a46] text-white text-sm font-semibold hover:bg-[#1c3d66] disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${retraining ? "animate-spin" : ""}`} />
          {retraining ? "Retraining..." : "Retrain with Verified Reports"}
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 shrink-0" />
          <span>{notice}</span>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500 py-8 text-center">
          Loading AI evaluation report...
        </div>
      ) : (
        evalData && (
          <div className="space-y-6">
            {/* Important RSBVP Note */}
            <div className="rounded-xl border border-teal-200 bg-[#eef6f5] p-4 text-xs text-slate-700">
              <strong className="text-[#132a46]">Evaluation Scope Note:</strong>{" "}
              {evalData.dataset_note} These metrics demonstrate the train/test split
              methodology and should not be claimed as real-world field accuracy.
            </div>

            {/* Summary Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500">Prototype Test Accuracy</div>
                <div className="text-2xl font-bold text-[#132a46] mt-1">
                  {(evalData.test_accuracy * 100).toFixed(1)}%
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Unseen test split</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500">Training Samples</div>
                <div className="text-2xl font-bold text-[#132a46] mt-1">
                  {evalData.train_samples}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Includes {evalData.verified_feedback_samples} verified live
                </div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500">Unseen Test Samples</div>
                <div className="text-2xl font-bold text-[#132a46] mt-1">
                  {evalData.test_samples}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">Strictly separated</div>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="text-xs text-slate-500">Uncertainty Policy</div>
                <div className="text-lg font-bold text-amber-700 mt-1">&lt; 60% Conf.</div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Flags Needs Human Review
                </div>
              </div>
            </div>

            {/* Per-Category Precision / Recall / F1 */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <div className="flex items-center gap-2 font-bold text-[#132a46]">
                <BarChart3 className="w-5 h-5" />
                Per-Category Test Split Metrics
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                      <th className="py-2 pr-4">Category</th>
                      <th className="py-2 pr-4">Precision</th>
                      <th className="py-2 pr-4">Recall</th>
                      <th className="py-2">F1 Score</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {evalData.categories.map((cat) => {
                      const m = evalData.per_category_metrics[cat];
                      return (
                        <tr key={cat}>
                          <td className="py-2.5 pr-4 font-medium text-[#132a46]">{cat}</td>
                          <td className="py-2.5 pr-4 font-mono">
                            {m ? (m.precision * 100).toFixed(1) + "%" : "—"}
                          </td>
                          <td className="py-2.5 pr-4 font-mono">
                            {m ? (m.recall * 100).toFixed(1) + "%" : "—"}
                          </td>
                          <td className="py-2.5 font-mono">
                            {m ? (m.f1 * 100).toFixed(1) + "%" : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Confusion Matrix */}
            <div className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
              <div className="font-bold text-[#132a46]">
                Confusion Matrix (Rows = True Label, Cols = Predicted)
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-center border-collapse">
                  <thead>
                    <tr>
                      <th className="p-2 text-left text-slate-500 border-b border-slate-200">
                        True \ Pred
                      </th>
                      {evalData.categories.map((c) => (
                        <th
                          key={c}
                          className="p-2 text-slate-600 border-b border-slate-200 font-semibold"
                        >
                          {c.split(" ")[0]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {evalData.confusion_matrix.map((row, rIdx) => (
                      <tr key={evalData.categories[rIdx]} className="border-b border-slate-100">
                        <td className="p-2 text-left font-medium text-[#132a46]">
                          {evalData.categories[rIdx]}
                        </td>
                        {row.map((val, cIdx) => (
                          <td
                            key={cIdx}
                            className={`p-2 font-mono font-semibold ${
                              rIdx === cIdx
                                ? "bg-emerald-50 text-emerald-800"
                                : val > 0
                                  ? "bg-amber-50 text-amber-800"
                                  : "text-slate-400"
                            }`}
                          >
                            {val}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-[11px] text-slate-500">
                Model: {evalData.model_name} &middot; Last trained:{" "}
                {new Date(evalData.trained_at).toLocaleString()}
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
}
