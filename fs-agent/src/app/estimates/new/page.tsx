"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewEstimatePage() {
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Name is required");
      return;
    }
    if (!owner.trim()) {
      setError("Owner is required");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/estimates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          owner: owner.trim(),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create estimate");
      }
      const estimate = await res.json();
      router.push(`/estimates/${estimate.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create estimate");
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
                Create New Estimate
              </p>
              <h1 className="text-3xl font-semibold text-slate-900">
                New Estimate
              </h1>
              <p className="text-sm text-slate-500">
                Create a new project estimate to begin the estimation workflow.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/estimates")}
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
              <label
                htmlFor="name"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Project Name <span className="text-rose-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., E-commerce Platform Redesign"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                disabled={creating}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !creating && name.trim() && owner.trim()) {
                    handleCreate();
                  }
                }}
              />
            </div>

            <div>
              <label
                htmlFor="owner"
                className="text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                Owner / Client <span className="text-rose-500">*</span>
              </label>
              <input
                id="owner"
                type="text"
                value={owner}
                onChange={(e) => setOwner(e.target.value)}
                placeholder="e.g., Acme Corporation"
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                disabled={creating}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !creating && name.trim() && owner.trim()) {
                    handleCreate();
                  }
                }}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => router.push("/estimates")}
                disabled={creating}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating || !name.trim() || !owner.trim()}
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {creating ? "Creating…" : "Create Estimate"}
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

