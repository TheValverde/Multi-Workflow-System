"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
// @ts-ignore - diff library may not have types
import { diffWords } from "diff";
import type { ReviewProposal, ReviewResponse } from "@/lib/contracts";

export default function ReviewScreen({
  agreementId,
}: {
  agreementId: string;
}) {
  const [agreement, setAgreement] = useState<{ content: string; type: string } | null>(null);
  const [clientDraft, setClientDraft] = useState("");
  const [uploading, setUploading] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [proposals, setProposals] = useState<ReviewProposal[]>([]);
  const [selectedProposals, setSelectedProposals] = useState<Set<string>>(new Set());
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetch(`/api/contracts/${agreementId}`)
      .then((res) => res.json())
      .then((data) => {
        setAgreement(data);
      })
      .catch((err) => {
        setError(err.message);
      });
  }, [agreementId]);

  const handleFileUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/contracts/${agreementId}/draft`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        throw new Error("Failed to upload draft");
      }
      const draft = await res.json();
      if (draft.content) {
        setClientDraft(draft.content);
      } else {
        // Try to read from storage
        const text = await file.text();
        setClientDraft(text);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to upload draft");
    } finally {
      setUploading(false);
    }
  };

  const handleReview = async () => {
    if (!clientDraft.trim()) {
      setError("Please provide a client draft to review");
      return;
    }
    setReviewing(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/${agreementId}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: clientDraft }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Review failed");
      }
      const reviewData = (await res.json()) as ReviewResponse;
      setProposals(reviewData.proposals || []);
      setSelectedProposals(new Set(reviewData.proposals?.map((p) => p.id) || []));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to review draft");
    } finally {
      setReviewing(false);
    }
  };

  const handleApplyProposals = async () => {
    if (selectedProposals.size === 0) {
      setError("Please select at least one proposal to apply");
      return;
    }
    setApplying(true);
    setError(null);
    try {
      // Apply proposals to current content
      let newContent = agreement?.content || "";
      const proposalsToApply = proposals.filter((p) =>
        selectedProposals.has(p.id),
      );
      
      // Simple replacement - in production, this would be more sophisticated
      for (const proposal of proposalsToApply) {
        newContent = newContent.replace(proposal.before, proposal.after);
      }

      const res = await fetch(`/api/contracts/${agreementId}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newContent,
          notes: `Applied ${proposalsToApply.length} proposal(s) from review`,
          proposals_applied: Array.from(selectedProposals),
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to apply proposals");
      }
      router.push(`/contracts/${agreementId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to apply proposals");
    } finally {
      setApplying(false);
    }
  };

  const toggleProposal = (id: string) => {
    const newSet = new Set(selectedProposals);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedProposals(newSet);
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Review Client Draft
              </p>
              <h1 className="text-3xl font-semibold text-slate-900">
                Policy-Based Review
              </h1>
              <p className="text-sm text-slate-500">
                Upload or paste the client's draft to generate change proposals
                based on your policy rules.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => router.push(`/contracts/${agreementId}`)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Back to Agreement
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
          <h2 className="mb-4 text-xl font-semibold text-slate-900">
            Client Draft
          </h2>
          <div className="space-y-4">
            <div className="flex gap-4">
              <label className="flex cursor-pointer items-center gap-2 rounded-full border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50">
                <input
                  type="file"
                  accept=".txt,.md,.doc,.docx"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                  className="hidden"
                />
                {uploading ? "Uploading…" : "Upload File"}
              </label>
            </div>
            <textarea
              value={clientDraft}
              onChange={(e) => setClientDraft(e.target.value)}
              placeholder="Or paste the client's draft here…"
              className="min-h-[300px] w-full rounded-2xl border border-slate-200 p-4 text-sm"
            />
            <button
              onClick={handleReview}
              disabled={reviewing || !clientDraft.trim()}
              className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {reviewing ? "Reviewing…" : "Run Review"}
            </button>
          </div>
        </section>

        {proposals.length > 0 && (
          <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-xl font-semibold text-slate-900">
                Change Proposals ({proposals.length})
              </h2>
              <button
                onClick={handleApplyProposals}
                disabled={applying || selectedProposals.size === 0}
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {applying
                  ? "Applying…"
                  : `Apply ${selectedProposals.size} Selected`}
              </button>
            </div>
            <div className="space-y-4">
              {proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  selected={selectedProposals.has(proposal.id)}
                  onToggle={() => toggleProposal(proposal.id)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function ProposalCard({
  proposal,
  selected,
  onToggle,
}: {
  proposal: ReviewProposal;
  selected: boolean;
  onToggle: () => void;
}) {
  // diffWords returns an array of change objects comparing before to after
  const diffResult = diffWords(proposal.before, proposal.after);

  return (
    <div
      className={`rounded-2xl border p-4 ${
        selected
          ? "border-slate-900 bg-slate-50"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex items-start gap-4">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="mt-1"
        />
        <div className="flex-1 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              {proposal.section && (
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  {proposal.section}
                </p>
              )}
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {proposal.rationale}
              </p>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Before
              </p>
              <div className="text-sm text-slate-900">
                {diffResult.map((part: { added?: boolean; removed?: boolean; value: string }, i: number) => {
                  if (part.added) return null;
                  return (
                    <span
                      key={i}
                      className={
                        part.removed
                          ? "bg-rose-100 text-rose-900 line-through"
                          : ""
                      }
                    >
                      {part.value}
                    </span>
                  );
                })}
              </div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-green-50 p-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                After
              </p>
              <div className="text-sm text-slate-900">
                {diffResult.map((part: { added?: boolean; removed?: boolean; value: string }, i: number) => {
                  if (part.removed) return null;
                  return (
                    <span
                      key={i}
                      className={
                        part.added
                          ? "bg-green-200 text-green-900 font-semibold"
                          : ""
                      }
                    >
                      {part.value}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

