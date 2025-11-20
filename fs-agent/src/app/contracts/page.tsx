"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useCopilotContext } from "@/hooks/useCopilotContext";
import type { AgreementRecord } from "@/lib/contracts";

export default function ContractsPage() {
  const [agreements, setAgreements] = useState<AgreementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  
  // Sync copilot context for workflow awareness
  useCopilotContext("contracts", null, null);

  const loadAgreements = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/contracts");
      if (!res.ok) {
        throw new Error("Failed to load agreements");
      }
      const data = await res.json();
      setAgreements(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load agreements");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAgreements();
  }, [loadAgreements]);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Contracts Workflow
              </p>
              <h1 className="text-3xl font-semibold text-slate-900">
                Agreements
              </h1>
              <p className="text-sm text-slate-500">
                Manage MSAs, SOWs, NDAs, and other agreements with version
                control and policy-based reviews.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/contracts/new")}
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                New Agreement
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
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                All Agreements
              </h2>
              <p className="text-sm text-slate-500">
                Click any row to view details and manage versions.
              </p>
            </div>
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-slate-500">Loading agreements…</p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3 text-left">Type</th>
                    <th className="px-4 py-3 text-left">Counterparty</th>
                    <th className="px-4 py-3 text-left">Version</th>
                    <th className="px-4 py-3 text-left">Linked Estimate</th>
                    <th className="px-4 py-3 text-left">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {agreements.map((agreement) => (
                    <tr
                      key={agreement.id}
                      onClick={() => router.push(`/contracts/${agreement.id}`)}
                      className="cursor-pointer transition hover:bg-slate-50"
                    >
                      <td className="px-4 py-3">
                        <span className="rounded-full border border-slate-200 px-2 py-0.5 text-xs font-semibold">
                          {agreement.type}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {agreement.counterparty}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        v{agreement.current_version}
                      </td>
                      <td className="px-4 py-3">
                        {agreement.linked_estimate_id ? (
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-700">
                            Linked
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-500">
                        {formatDistanceToNow(new Date(agreement.updated_at), {
                          addSuffix: true,
                        })}
                      </td>
                    </tr>
                  ))}
                  {agreements.length === 0 && (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-6 text-center text-sm text-slate-500"
                      >
                        No agreements yet. Click "New Agreement" to create your
                        first one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

