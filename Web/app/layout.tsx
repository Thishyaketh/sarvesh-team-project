import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CivicPulse — AI-Assisted Community Problem Reporting",
  description:
    "RSBVP 2026-27 Prototype: AI-assisted community problem detection, similarity checking, human review, and OpenStreetMap dashboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#f5f8fb] text-slate-900">
        <Navbar />
        <main className="flex-1">{children}</main>
        <footer className="border-t border-slate-200 bg-white mt-12">
          <div className="max-w-6xl mx-auto px-4 py-5 text-xs text-slate-600 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
            <div>
              <span className="font-semibold text-[#132a46]">CivicPulse</span>{" "}
              &middot; RSBVP 2026&ndash;27 (Class XI-A, PM SHRI Kendriya Vidyalaya, Ashok Nagar, Chennai)
            </div>
            <div>
              Prototype software: AI suggestions &amp; priority bands are assistive only; human review is required.
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
