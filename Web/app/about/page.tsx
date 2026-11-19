import { BookOpen, ShieldAlert, Cpu, Scale } from "lucide-react";

const FEATURE_STATUS = [
  {
    feature: "Report submission & validation (photo, description, location)",
    status: "Working",
    note: "Validates file types/sizes, required text, and rounds coordinates for privacy.",
  },
  {
    feature: "Persistent SQLite database storage",
    status: "Working",
    note: "Stores submitted reports and review audit logs across restarts.",
  },
  {
    feature: "Image classification baseline",
    status: "Simulated Baseline",
    note: "Uses Pillow visual statistics + keyword cues with an uncertainty threshold (<60% -> Needs human review). Replaceable with a trained Teachable Machine / TensorFlow model.",
  },
  {
    feature: "Text similarity duplicate suggestions",
    status: "Working",
    note: "Uses TF-IDF cosine similarity + location overlap; never auto-merges reports.",
  },
  {
    feature: "OpenStreetMap & dashboard summary",
    status: "Working",
    note: "Displays approximate locations, category totals, and workflow status counts.",
  },
  {
    feature: "Initial neighbourhood demonstration records",
    status: "Sample",
    note: "Pre-seeded records around Ashok Nagar, Chennai are clearly labelled as Sample.",
  },
];

export default function AboutPage() {
  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-[#132a46]">
          About CivicPulse &amp; Responsible AI Design
        </h1>
        <p className="text-sm text-slate-600">
          RSBVP 2026&ndash;27 &middot; Sub-theme: Artificial Intelligence (AI) for Better
          Life &middot; Class XI-A, PM SHRI Kendriya Vidyalaya, Ashok Nagar, Chennai.
        </p>
      </div>

      {/* Scientific Principle */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
        <div className="flex items-center gap-2 font-bold text-[#132a46]">
          <Cpu className="w-5 h-5" />
          Scientific Principle
        </div>
        <p className="text-sm text-slate-700 leading-relaxed">
          CivicPulse combines three ideas: <strong>Computer Vision</strong> to analyse
          visual patterns in uploaded photographs, <strong>Natural-Language Processing
          (NLP)</strong> to compare short written descriptions and suggest possible
          duplicates, and <strong>Data Analysis</strong> to organise reports by category,
          approximate location, and time. These systems learn or match patterns from
          examples; they do not understand a neighbourhood in the same way a person does.
        </p>
      </section>

      {/* Transparent Priority Estimate */}
      <section className="bg-[#eef6f5] rounded-xl border border-teal-200 p-6 space-y-3">
        <div className="flex items-center gap-2 font-bold text-[#132a46]">
          <Scale className="w-5 h-5" />
          Transparent Priority Estimate
        </div>
        <div className="font-mono text-sm bg-white border border-teal-200 rounded-lg px-4 py-3 text-[#132a46] font-semibold">
          P = 0.35S + 0.30I + 0.20R + 0.15T
        </div>
        <p className="text-sm text-slate-700">
          Where <strong>S</strong> = estimated severity, <strong>I</strong> = public
          impact, <strong>R</strong> = recurrence, and <strong>T</strong> = time
          unresolved (each rated 0&ndash;100). Bands:{" "}
          <strong>LOW (0&ndash;29)</strong>, <strong>MEDIUM (30&ndash;59)</strong>,{" "}
          <strong>HIGH (60&ndash;79)</strong>, <strong>CRITICAL (80&ndash;100)</strong>.
        </p>
        <p className="text-xs text-slate-600">
          Illustrative bands only &mdash; not an official rating, validated government
          standard, or automatic worker dispatch mechanism. Missing information is never
          treated as zero severity.
        </p>
      </section>

      {/* Feature Status */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-4">
        <div className="flex items-center gap-2 font-bold text-[#132a46]">
          <BookOpen className="w-5 h-5" />
          Prototype Feature Status (Honest Labelling)
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead>
              <tr className="border-b border-slate-200 text-xs uppercase text-slate-500">
                <th className="py-2 pr-4">Feature</th>
                <th className="py-2 pr-4">Label</th>
                <th className="py-2">Implementation Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {FEATURE_STATUS.map((row) => (
                <tr key={row.feature}>
                  <td className="py-2.5 pr-4 font-medium text-[#132a46]">{row.feature}</td>
                  <td className="py-2.5 pr-4">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-800">
                      {row.status}
                    </span>
                  </td>
                  <td className="py-2.5 text-slate-600 text-xs">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Safety & Privacy */}
      <section className="bg-white rounded-xl border border-slate-200 p-6 space-y-3">
        <div className="flex items-center gap-2 font-bold text-[#132a46]">
          <ShieldAlert className="w-5 h-5" />
          Safety, Privacy &amp; Responsible AI Checklist
        </div>
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1.5">
          <li>Collect only the information needed for a civic report; no personal identity details.</li>
          <li>Use approximate public locations rather than displaying a reporter&apos;s home address.</li>
          <li>Avoid capturing faces, vehicle number plates, or private property in uploaded photos.</li>
          <li>Explain that AI suggestions can be wrong; allow users and reviewers to correct categories.</li>
          <li>Never auto-merge duplicate suggestions or use the priority score for automatic enforcement.</li>
        </ul>
      </section>
    </div>
  );
}
