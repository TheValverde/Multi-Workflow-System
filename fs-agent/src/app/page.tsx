"use client";

import DashboardView from "@/components/dashboard/DashboardView";
import Link from "next/link";

export default function DashboardPage() {
  return (
    <main>
      <div className="absolute left-0 right-0 top-0 z-10 border-b border-white/20 bg-slate-900/40 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 text-sm text-white">
          <div className="font-semibold tracking-wide uppercase text-white/80">
            fs-agent Dashboard
          </div>
          <div className="flex items-center gap-3 text-white/90">
            <Link
              href="/estimates"
              className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white ring-1 ring-white/30 transition hover:bg-white/20"
            >
              Estimates
            </Link>
            <Link
              href="/policies"
              className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white ring-1 ring-white/30 transition hover:bg-white/20"
            >
              Policies
            </Link>
            <Link
              href="/contracts"
              className="rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-wide text-white ring-1 ring-white/30 transition hover:bg-white/20"
            >
              Contracts
            </Link>
          </div>
        </div>
      </div>
      <DashboardView />
    </main>
  );
}
