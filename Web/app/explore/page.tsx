"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Search, Filter, AlertTriangle, MapPin } from "lucide-react";
import CivicMap from "@/components/CivicMap";
import {
  API_BASE,
  CATEGORIES,
  STATUSES,
  imageUrl,
  priorityBadgeClass,
  statusBadgeClass,
  type Report,
  type StatsResponse,
} from "@/lib/types";

export default function ExplorePage() {
  const [reports, setReports] = useState<Report[]>([]);
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [category, setCategory] = useState("All");
  const [status, setStatus] = useState("All");
  const [search, setSearch] = useState("");
  const [includeSample, setIncludeSample] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category !== "All") params.set("category", category);
      if (status !== "All") params.set("status", status);
      if (search.trim()) params.set("search", search.trim());
      params.set("include_sample", String(includeSample));

      const [repRes, statRes] = await Promise.all([
        fetch(`${API_BASE}/api/reports?${params.toString()}`),
        fetch(`${API_BASE}/api/stats?include_sample=${includeSample}`),
      ]);
      if (!repRes.ok || !statRes.ok) {
        throw new Error("Failed to load reports from backend.");
      }
      const repJson = await repRes.json();
      const statJson = await statRes.json();
      setReports(repJson.reports || []);
      setStats(statJson);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not connect to backend.");
    } finally {
      setLoading(false);
    }
  }, [category, status, search, includeSample]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-[#132a46]">
            Explore Reports, Map &amp; Dashboard
          </h1>
          <p className="text-sm text-slate-600">
            Approximate public locations on OpenStreetMap, category totals, and illustrative
            priority scores.
          </p>
        </div>
        <Link
          href="/report"
          className="px-4 py-2 rounded-lg bg-[#132a46] text-white text-sm font-semibold hover:bg-[#1c3d66]"
        >
          + New Report
        </Link>
      </div>

      {error && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Dashboard Summary */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Category Totals
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {Object.entries(stats.category_counts).map(([cat, count]) => (
                <div
                  key={cat}
                  className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-100"
                >
                  <span className="text-slate-700 truncate pr-2">{cat}</span>
                  <span className="font-bold text-[#132a46]">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-2">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Workflow Status Counts
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
              {Object.entries(stats.status_counts).map(([st, count]) => (
                <div
                  key={st}
                  className="flex items-center justify-between bg-slate-50 rounded-lg px-3 py-1.5 border border-slate-100"
                >
                  <span className="text-slate-700">{st}</span>
                  <span className="font-bold text-[#132a46]">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* OpenStreetMap */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-1.5 font-semibold text-[#132a46] text-sm">
            <MapPin className="w-4 h-4" />
            Approximate Report Locations ({reports.length})
          </div>
          <span>Click any marker to inspect category, status, and priority band.</span>
        </div>
        <CivicMap reports={reports} heightClass="h-80" />
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-[#132a46]">
          <Filter className="w-4 h-4" /> Filters:
        </div>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search description or landmark..."
            className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-300 text-sm"
          />
        </div>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
        >
          <option value="All">All Categories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
        >
          <option value="All">All Statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={includeSample}
            onChange={(e) => setIncludeSample(e.target.checked)}
            className="rounded border-slate-300"
          />
          Show Sample Data
        </label>
      </div>

      {/* Report Cards */}
      {loading ? (
        <div className="text-sm text-slate-500 py-8 text-center">Loading reports...</div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">
          No reports match your current filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {reports.map((r) => (
            <div
              key={r.id}
              className="bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col sm:flex-row"
            >
              <div className="sm:w-40 h-44 sm:h-auto bg-slate-100 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageUrl(r.image_path)}
                  alt={r.category}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="p-4 flex-1 flex flex-col justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded ${
                        r.is_sample
                          ? "bg-slate-100 text-slate-700"
                          : "bg-indigo-100 text-indigo-800"
                      }`}
                    >
                      {r.is_sample ? "Sample" : "Live"}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded ${statusBadgeClass(
                        r.status
                      )}`}
                    >
                      {r.status}
                    </span>
                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${priorityBadgeClass(
                        r.priority_band
                      )}`}
                    >
                      {r.priority_band} ({r.priority_score})
                    </span>
                    {r.needs_human_review && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800">
                        Needs Review
                      </span>
                    )}
                  </div>

                  <div className="font-bold text-[#132a46] text-sm">
                    #{r.id} &middot; {r.category}
                  </div>
                  <p className="text-xs text-slate-700 leading-relaxed">{r.description}</p>
                  <div className="text-[11px] text-slate-500">
                    Location: {r.location_label} ({r.approx_lat.toFixed(4)},{" "}
                    {r.approx_lng.toFixed(4)})
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
                  <span>
                    AI: {r.ai_suggested_category} ({Math.round(r.ai_confidence * 100)}%)
                  </span>
                  <Link
                    href={`/review?id=${r.id}`}
                    className="font-semibold text-[#132a46] hover:underline"
                  >
                    Review &rarr;
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
