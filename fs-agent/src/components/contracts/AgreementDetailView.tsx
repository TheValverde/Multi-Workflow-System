"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import { useCoAgent, useCopilotAction } from "@copilotkit/react-core";
import RichTextEditor from "@/components/project-detail/RichTextEditor";
import type {
  AgreementDetail,
  AgreementVersion,
  AgreementNote,
} from "@/lib/contracts";

type AgentState = {
  selected_agreement_id?: string;
  selected_agreement_type?: string;
  selected_agreement_version?: number;
};

export default function AgreementDetailView({
  agreementId,
}: {
  agreementId: string;
}) {
  const [agreement, setAgreement] = useState<AgreementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [content, setContent] = useState("");
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [estimates, setEstimates] = useState<Array<{ id: string; name: string; stage: string }>>([]);
  const [linkingEstimate, setLinkingEstimate] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [validating, setValidating] = useState(false);
  const [markingReady, setMarkingReady] = useState(false);
  const [overrideRationale, setOverrideRationale] = useState("");
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const router = useRouter();

  const { state, setState } = useCoAgent<AgentState>({
    name: "sample_agent",
    initialState: {},
  });

  const setStateRef = useRef(setState);
  setStateRef.current = setState;

  const loadAgreement = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/${agreementId}`);
      if (!res.ok) {
        throw new Error("Failed to load agreement");
      }
      const data = await res.json();
      setAgreement(data);
      setContent(data.content || "");
      setSelectedVersion(data.current_version);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load agreement");
    } finally {
      setLoading(false);
    }
  }, [agreementId]);

  useEffect(() => {
    loadAgreement();
  }, [loadAgreement]);

  useEffect(() => {
    // Load estimates for selector
    fetch("/api/estimates")
      .then((res) => res.json())
      .then((data) => {
        if (data.data && Array.isArray(data.data)) {
          setEstimates(data.data);
        }
      })
      .catch((err) => {
        console.error("Failed to load estimates:", err);
      });
  }, []);

  useEffect(() => {
    if (agreement) {
      setStateRef.current({
        selected_agreement_id: agreement.id,
        selected_agreement_type: agreement.type,
        selected_agreement_version: agreement.current_version,
      });
    }
  }, [agreement]);

  const handleSave = async () => {
    if (!agreement) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/${agreement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        throw new Error("Failed to save");
      }
      await loadAgreement();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateVersion = async () => {
    if (!agreement) return;
    if (!confirm("Create a new version with current content?")) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/contracts/${agreement.id}/versions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          notes: "New version created",
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to create version");
      }
      await loadAgreement();
      setSelectedVersion(agreement.current_version + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to create version");
    } finally {
      setSaving(false);
    }
  };

  const handleAddNote = async () => {
    if (!agreement || !noteText.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/contracts/${agreement.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note_text: noteText.trim() }),
      });
      if (!res.ok) {
        throw new Error("Failed to add note");
      }
      setNoteText("");
      await loadAgreement();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to add note");
    } finally {
      setAddingNote(false);
    }
  };

  const handleLinkEstimate = async (estimateId: string | null) => {
    if (!agreement) return;
    setLinkingEstimate(true);
    try {
      const res = await fetch(`/api/contracts/${agreement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linked_estimate_id: estimateId }),
      });
      if (!res.ok) {
        throw new Error("Failed to link estimate");
      }
      await loadAgreement();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to link estimate");
    } finally {
      setLinkingEstimate(false);
    }
  };

  const handleValidate = async () => {
    if (!agreement) return;
    setValidating(true);
    try {
      const res = await fetch(`/api/contracts/${agreement.id}/validate`);
      if (!res.ok) {
        throw new Error("Failed to validate");
      }
      const result = await res.json();
      setValidationResult(result);
      
      // Log validation to notes
      if (result.summary) {
        await fetch(`/api/contracts/${agreement.id}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            note_text: `Validation: ${result.summary} (${result.discrepancies?.length || 0} discrepancies)`,
          }),
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to validate");
    } finally {
      setValidating(false);
    }
  };

  const handleMarkReadyForSignature = async () => {
    if (!agreement) return;
    
    // For SOWs, check validation
    if (agreement.type === "SOW" && agreement.linked_estimate_id) {
      // If not validated or has errors, require override
      if (!validationResult || !validationResult.valid) {
        if (!overrideRationale.trim()) {
          setShowOverrideModal(true);
          return;
        }
      }
    }

    setMarkingReady(true);
    try {
      const res = await fetch(`/api/contracts/${agreement.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ready_for_signature: true,
          signature_override_rationale: overrideRationale.trim() || null,
        }),
      });
      if (!res.ok) {
        throw new Error("Failed to mark ready");
      }
      await loadAgreement();
      setShowOverrideModal(false);
      setOverrideRationale("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to mark ready");
    } finally {
      setMarkingReady(false);
    }
  };

  const handleViewVersion = (version: AgreementVersion) => {
    setContent(version.content);
    setSelectedVersion(version.version_number);
  };

  useCopilotAction({
    name: "addNote",
    description: "Add a note to the current agreement.",
    parameters: [
      { name: "note", type: "string", required: true },
    ],
    handler: async ({ note }) => {
      if (!agreement) {
        return "No agreement loaded.";
      }
      try {
        const res = await fetch(`/api/contracts/${agreement.id}/notes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note_text: note }),
        });
        if (!res.ok) {
          throw new Error("Failed to add note");
        }
        await loadAgreement();
        return `Note added: "${note}"`;
      } catch (err) {
        return `Failed to add note: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  useCopilotAction({
    name: "applyProposals",
    description: "Apply selected change proposals to create a new version.",
    parameters: [
      { name: "proposal_ids", type: "string", required: true },
      { name: "notes", type: "string" },
    ],
    handler: async ({ proposal_ids, notes }) => {
      if (!agreement) {
        return "No agreement loaded.";
      }
      try {
        const proposalIds = proposal_ids.split(",").map((id) => id.trim());
        // This will be called from the review screen
        return `Proposals ${proposalIds.join(", ")} will be applied.`;
      } catch (err) {
        return `Failed to apply proposals: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  useCopilotAction({
    name: "validate_against_estimate",
    description: "Validate the SOW against the linked estimate and post summary to notes.",
    handler: async () => {
      if (!agreement) {
        return "No agreement loaded.";
      }
      if (agreement.type !== "SOW") {
        return "Validation is only available for SOW agreements.";
      }
      if (!agreement.linked_estimate_id) {
        return "No estimate linked to this SOW. Please link an estimate first.";
      }
      try {
        await handleValidate();
        if (validationResult) {
          return validationResult.summary;
        }
        return "Validation completed. Check the validation results panel.";
      } catch (err) {
        return `Failed to validate: ${err instanceof Error ? err.message : String(err)}`;
      }
    },
  });

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-slate-500">Loading agreement…</p>
      </div>
    );
  }

  if (error || !agreement) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <p className="text-rose-600">{error || "Agreement not found"}</p>
          <button
            onClick={() => router.push("/contracts")}
            className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white"
          >
            Back to Agreements
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex max-w-7xl flex-col gap-8">
        <header className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                {agreement.type} Agreement
              </p>
              <h1 className="text-3xl font-semibold text-slate-900">
                {agreement.counterparty}
              </h1>
              <p className="text-sm text-slate-500">
                Version {agreement.current_version} ·{" "}
                {formatDistanceToNow(new Date(agreement.updated_at), {
                  addSuffix: true,
                })}
                {agreement.linked_estimate && (
                  <>
                    {" "}
                    · Linked to{" "}
                    <span className="font-semibold">
                      {agreement.linked_estimate.name}
                    </span>
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {agreement.type === "SOW" && agreement.linked_estimate_id && (
                <button
                  onClick={handleValidate}
                  disabled={validating}
                  className="rounded-full border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
                >
                  {validating ? "Validating…" : "Validate Against Estimate"}
                </button>
              )}
              <button
                onClick={() => router.push(`/contracts/${agreement.id}/review`)}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Review Draft
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save Changes"}
              </button>
              <button
                onClick={handleCreateVersion}
                disabled={saving}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50"
              >
                Create Version
              </button>
              {agreement.type === "SOW" && !agreement.ready_for_signature && (
                <button
                  onClick={handleMarkReadyForSignature}
                  disabled={markingReady}
                  className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:opacity-50"
                >
                  {markingReady ? "Marking…" : "Mark Ready for Signature"}
                </button>
              )}
              {agreement.ready_for_signature && (
                <span className="rounded-full bg-green-100 px-4 py-2 text-sm font-semibold text-green-700">
                  ✓ Ready for Signature
                </span>
              )}
            </div>
          </div>
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          )}
        </header>

        <div className="grid gap-8 lg:grid-cols-[1fr,320px]">
          <section className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <h2 className="mb-4 text-xl font-semibold text-slate-900">
                Agreement Content
              </h2>
              <RichTextEditor value={content} onChange={setContent} />
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">
                {agreement.type === "SOW" ? "Link Estimate" : "Estimate Link"}
              </h3>
              {agreement.type === "SOW" ? (
                <>
                  {estimates.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Loading estimates…
                    </p>
                  ) : (
                    <>
                      <select
                        value={agreement.linked_estimate_id || ""}
                        onChange={(e) => handleLinkEstimate(e.target.value || null)}
                        disabled={linkingEstimate}
                        className="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="">Select an estimate…</option>
                        {estimates.map((est) => (
                          <option key={est.id} value={est.id}>
                            {est.name} ({est.stage})
                          </option>
                        ))}
                      </select>
                      {agreement.linked_estimate && (
                        <p className="mt-2 text-xs text-slate-500">
                          Linked to: {agreement.linked_estimate.name}
                        </p>
                      )}
                    </>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-500">
                  Estimate linking is only available for SOW agreements. This is a {agreement.type}.
                </p>
              )}
            </div>

            {validationResult && (
              <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
                <h3 className="mb-4 text-lg font-semibold text-slate-900">
                  Validation Results
                </h3>
                <div className={`mb-3 rounded-2xl p-3 ${
                  validationResult.valid
                    ? "bg-green-50 border border-green-200"
                    : "bg-rose-50 border border-rose-200"
                }`}>
                  <p className={`text-sm font-semibold ${
                    validationResult.valid ? "text-green-900" : "text-rose-900"
                  }`}>
                    {validationResult.valid ? "✓ Valid" : "✗ Issues Found"}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {validationResult.summary}
                  </p>
                </div>
                {validationResult.discrepancies?.length > 0 && (
                  <div className="space-y-2">
                    {validationResult.discrepancies.map((disc: any) => (
                      <div
                        key={disc.id}
                        className={`rounded-xl border p-3 text-sm ${
                          disc.severity === "error"
                            ? "border-rose-200 bg-rose-50"
                            : disc.severity === "warning"
                              ? "border-yellow-200 bg-yellow-50"
                              : "border-blue-200 bg-blue-50"
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <span className={`text-xs font-semibold uppercase ${
                            disc.severity === "error"
                              ? "text-rose-700"
                              : disc.severity === "warning"
                                ? "text-yellow-700"
                                : "text-blue-700"
                          }`}>
                            {disc.severity}
                          </span>
                          <span className="text-xs text-slate-500">
                            {disc.category}
                          </span>
                        </div>
                        <p className="mt-1 text-slate-900">{disc.message}</p>
                        {disc.reference && (
                          <p className="mt-1 text-xs text-slate-500">
                            Reference: {disc.reference}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">
                Version Timeline
              </h3>
              <div className="space-y-3">
                {agreement.versions.map((version) => (
                  <button
                    key={version.id}
                    onClick={() => handleViewVersion(version)}
                    className={`w-full rounded-2xl border p-3 text-left transition ${
                      selectedVersion === version.version_number
                        ? "border-slate-900 bg-slate-50"
                        : "border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-slate-900">
                        v{version.version_number}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDistanceToNow(new Date(version.created_at), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    {version.created_by && (
                      <p className="mt-1 text-xs text-slate-500">
                        by {version.created_by}
                      </p>
                    )}
                    {version.notes && (
                      <p className="mt-1 text-xs text-slate-600">
                        {version.notes}
                      </p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <h3 className="mb-4 text-lg font-semibold text-slate-900">
                Notes
              </h3>
              <div className="space-y-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleAddNote();
                      }
                    }}
                    placeholder="Add a note…"
                    className="flex-1 rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={addingNote || !noteText.trim()}
                    className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
                  >
                    Add
                  </button>
                </div>
                <div className="space-y-2">
                  {agreement.notes.map((note) => (
                    <div
                      key={note.id}
                      className="rounded-2xl border border-slate-100 p-3"
                    >
                      <p className="text-sm text-slate-900">{note.note_text}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatDistanceToNow(new Date(note.created_at), {
                          addSuffix: true,
                        })}
                        {note.created_by && ` · ${note.created_by}`}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {showOverrideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-xl font-semibold text-slate-900">
              Override Validation
            </h3>
            <p className="mb-4 text-sm text-slate-600">
              This SOW has validation discrepancies. Please provide a rationale for
              marking it ready for signature despite the issues.
            </p>
            <textarea
              value={overrideRationale}
              onChange={(e) => setOverrideRationale(e.target.value)}
              placeholder="Explain why this SOW can be signed despite the discrepancies..."
              className="mb-4 min-h-[100px] w-full rounded-2xl border border-slate-200 p-3 text-sm"
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowOverrideModal(false);
                  setOverrideRationale("");
                }}
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleMarkReadyForSignature}
                disabled={markingReady || !overrideRationale.trim()}
                className="rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {markingReady ? "Marking…" : "Mark Ready"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

