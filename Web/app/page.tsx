"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Camera,
  Cpu,
  UserCheck,
  MapPin,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
} from "lucide-react";
import { API_BASE, type StatsResponse } from "@/lib/types";

const WORKFLOW_STEPS = [
  {
    step: "1. REPORT",
    title: "Photo + Description",
    detail: "Residents submit a photograph, short description, and approximate public location.",
    icon: Camera,
  },
  {
    step: "2. AI CHECK",
    title: "Image + Text Analysis",
    detail: "AI suggests a category with confidence and checks for similar earlier reports.",
    icon: Cpu,
  },
  {
    step: "3. HUMAN REVIEW",
    title: "Check / Correct",
    detail: "A human reviewer verifies uncertain reports, corrects labels, and checks duplicates.",
    icon: UserCheck,
  },
  {
    step: "4. DISPLAY",
    title: "Map + Dashboard",
    detail: "Verified issues appear on an OpenStreetMap view and priority review dashboard.",
    icon: MapPin,
  },
];

const CATEGORY_CARDS = [
  {
    name: "Overflowing garbage bin",
    example: "Photo of a public waste bin",
    output: "Suggested class + confidence",
  },
  {
    name: "Water leakage",
    example: "Photo of visible water leakage in a public area",
    output: "Suggested class + confidence",
  },
  {
    name: "Damaged footpath / road",
    example: "Photo of a damaged public walking surface",
    output: "Suggested class + confidence",
  },
  {
    name: "Streetlight problem",
    example: "Photo of a streetlight that appears damaged or non-functional",
    output: "Suggested class + confidence",
  },
  {
    name: "Other / Not sure",
    example: "Unclear or unfamiliar problem",
    output: "Human review required",
  },
];

export default function HomePage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/stats`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed");
        return res.json();
      })
      .then((data: StatsResponse) => setStats(data))
      .catch(() => setOffline(true));
  }, []);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
      {/* Hero */}
      <section className="rounded-2xl bg-[#132a46] text-white p-7 sm:p-10 shadow-sm border border-[#1f3d63]">
        <div className="max-w-3xl space-y-4">
          <div className="inline-flex items-center gap-2 text-xs font-medium px-3 py-1 rounded-full bg-white/10 text-amber-200 border border-[#d4a843]/40">
            RSBVP 2026&ndash;27 &middot; Sub-Theme: AI for Better Life
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">
            CivicPulse: AI-Assisted Community Problem Detection &amp; Reporting
          </h1>
          <p className="text-slate-200 text-base leading-relaxed">
            A student-designed prototype for organising neighbourhood civic reports using
            photo classification, text-similarity duplicate suggestions, an OpenStreetMap
            dashboard, and human-in-the-loop verification.
          </p>
          <div className="flex flex-wrap gap-3 pt-2">
            <Link
              href="/report"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-[#d4a843] text-[#132a46] font-semibold text-sm hover:bg-[#e0b858] transition-colors"
            >
              Report a Civic Issue <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/explore"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/10 text-white font-medium text-sm hover:bg-white/20 transition-colors border border-white/20"
            >
              Explore Map &amp; Dashboard
            </Link>
            <Link
              href="/review"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-white/10 text-white font-medium text-sm hover:bg-white/20 transition-colors border border-white/20"
            >
              Human Review Queue
            </Link>
          </div>
        </div>
      </section>

      {/* Live / Sample Counters */}
      <section>
        {offline ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-700" />
            <div>
              Backend API is not reachable at <code className="font-mono">{API_BASE}</code>. Start the FastAPI server in <code className="font-mono">Backend/</code> to load live and sample reports.
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-medium">Total Reports</div>
              <div className="text-2xl font-bold text-[#132a46] mt-1">
                {stats ? stats.total_reports : "—"}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">
                {stats ? `${stats.live_count} Live · ${stats.sample_count} Sample` : "Loading..."}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-medium">Needs Human Review</div>
              <div className="text-2xl font-bold text-amber-700 mt-1">
                {stats ? stats.needs_human_review_count : "—"}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Uncertain or unverified</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-medium">Verified / In Progress</div>
              <div className="text-2xl font-bold text-sky-700 mt-1">
                {stats
                  ? (stats.status_counts["Verified"] ?? 0) +
                    (stats.status_counts["In Progress"] ?? 0)
                  : "—"}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Checked by reviewer</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="text-xs text-slate-500 font-medium">Resolved</div>
              <div className="text-2xl font-bold text-emerald-700 mt-1">
                {stats ? (stats.status_counts["Resolved"] ?? 0) : "—"}
              </div>
              <div className="text-[11px] text-slate-500 mt-1">Marked complete</div>
            </div>
          </div>
        )}
      </section>

      {/* 4-Step User Journey */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold text-[#132a46]">How CivicPulse Works</h2>
          <span className="text-xs text-slate-500">
            AI assists with sorting; people verify reports and decide what happens next.
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {WORKFLOW_STEPS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="bg-[#eef6f5] border border-teal-200/80 rounded-xl p-5 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-wider text-teal-900">
                    {item.step}
                  </span>
                  <Icon className="w-5 h-5 text-teal-800" />
                </div>
                <div className="font-semibold text-[#132a46]">{item.title}</div>
                <p className="text-sm text-slate-600 leading-relaxed">{item.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Proposed Categories */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="w-5 h-5 text-[#132a46]" />
          <h2 className="text-lg font-bold text-[#132a46]">Supported Report Categories</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500 text-xs uppercase">
                <th className="py-2.5 pr-4">Category</th>
                <th className="py-2.5 pr-4">Example Input</th>
                <th className="py-2.5">AI Output</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {CATEGORY_CARDS.map((cat) => (
                <tr key={cat.name}>
                  <td className="py-2.5 pr-4 font-medium text-[#132a46]">{cat.name}</td>
                  <td className="py-2.5 pr-4 text-slate-600">{cat.example}</td>
                  <td className="py-2.5 text-slate-700">{cat.output}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Responsible AI Note */}
      <section className="rounded-xl border border-teal-200 bg-[#eef6f5] p-5 flex items-start gap-3">
        <CheckCircle2 className="w-5 h-5 text-teal-800 shrink-0 mt-0.5" />
        <div className="text-sm text-slate-700 space-y-1">
          <div className="font-semibold text-[#132a46]">Responsible AI &amp; Privacy Commitment</div>
          <p>
            CivicPulse uses approximate public locations rather than home addresses, avoids
            collecting unnecessary personal identity details, never auto-merges duplicate
            suggestions, and keeps final verification with human reviewers.
          </p>
        </div>
      </section>
    </div>
  );
}
