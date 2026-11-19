"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ShieldCheck } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Home" },
  { href: "/report", label: "Report" },
  { href: "/explore", label: "Explore & Map" },
  { href: "/review", label: "Review Queue" },
  { href: "/ai", label: "AI Lab" },
  { href: "/about", label: "About" },
];

export default function Navbar() {
  const pathname = usePathname();

  return (
    <header className="bg-[#132a46] text-white border-b-2 border-[#d4a843]">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#d4a843]/20 border border-[#d4a843]/60 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#d4a843]" />
          </div>
          <div>
            <span className="font-bold tracking-tight text-lg">CivicPulse</span>
            <span className="ml-2 text-[11px] uppercase tracking-wider px-2 py-0.5 rounded bg-white/10 text-amber-200">
              Prototype
            </span>
          </div>
        </Link>

        <nav className="flex flex-wrap items-center gap-1 sm:gap-2">
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  active
                    ? "bg-[#d4a843] text-[#132a46]"
                    : "text-slate-200 hover:bg-white/10 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
