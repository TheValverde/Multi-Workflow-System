"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { AgreementType } from "@/lib/contracts";

export default function NewAgreementPage() {
  const [type, setType] = useState<AgreementType>("MSA");
  const [counterparty, setCounterparty] = useState("");
  const [content, setContent] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleCreate = async () => {
    if (!counterparty.trim()) {
      setError("Counterparty is required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          counterparty: counterparty.trim(),
          content: content.trim() || "",
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create agreement");
      }
      const agreement = await res.json();
      router.push(`/contracts/${agreement.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create agreement");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        <header className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Create New Agreement
              </p>
              <h1 className="text-3xl font-semibold text-slate-900">
                New Agreement
              </h1>
              <p className="text-sm text-slate-500">
                Create a new MSA, SOW, NDA, or Addendum.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/contracts")}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          )}
        </header>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="space-y-6">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Agreement Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as AgreementType)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="MSA">MSA</option>
                <option value="SOW">SOW</option>
                <option value="NDA">NDA</option>
                <option value="Addendum">Addendum</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Counterparty <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={counterparty}
                onChange={(e) => setCounterparty(e.target.value)}
                placeholder="Client or partner name"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Initial Content (Optional)
              </label>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="You can add content now or edit it later..."
                className="mt-1 min-h-[200px] w-full rounded-2xl border border-slate-200 p-4 text-sm"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => router.push("/contracts")}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !counterparty.trim()}
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {creating ? "Creating…" : "Create Agreement"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

