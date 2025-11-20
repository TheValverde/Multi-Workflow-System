"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useCopilotAction } from "@copilotkit/react-core";
import { useCopilotContext } from "@/hooks/useCopilotContext";

type PolicyRecord = {
  id: string;
  title: string;
  category: string | null;
  summary: string | null;
  body: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  exemplars: ExemplarRecord[];
};

type ExemplarRecord = {
  id: string;
  title: string;
  type: string;
  summary: string | null;
  tags: string[];
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  public_url: string;
};

type SummaryRecord = {
  policyCount: number;
  exemplarCount: number;
  lastUpdated: string | null;
};

type PolicyFormState = {
  title: string;
  category: string;
  summary: string;
  body: string;
  tags: string;
  exemplarIds: string[];
};

const emptyPolicyForm: PolicyFormState = {
  title: "",
  category: "",
  summary: "",
  body: "",
  tags: "",
  exemplarIds: [],
};

const EXEMPLAR_TYPES = ["MSA", "SOW", "NDA", "Addendum"];

export default function PoliciesPage() {
  // Sync copilot context for workflow awareness
  useCopilotContext("contracts", null, null);
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [exemplars, setExemplars] = useState<ExemplarRecord[]>([]);
  const [summary, setSummary] = useState<SummaryRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [savingPolicy, setSavingPolicy] = useState(false);
  const [deletingPolicy, setDeletingPolicy] = useState<string | null>(null);
  const [formState, setFormState] =
    useState<PolicyFormState>(emptyPolicyForm);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [uploadingExemplar, setUploadingExemplar] = useState(false);
  const [exemplarError, setExemplarError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [policiesRes, exemplarsRes, summaryRes] = await Promise.all([
        fetch("/api/policies"),
        fetch("/api/policies/exemplars"),
        fetch("/api/policies/summary"),
      ]);
      if (!policiesRes.ok) {
        throw new Error("Unable to load policies");
      }
      if (!exemplarsRes.ok) {
        throw new Error("Unable to load exemplars");
      }
      if (!summaryRes.ok) {
        throw new Error("Unable to load summary");
      }
      setPolicies(await policiesRes.json());
      setExemplars(await exemplarsRes.json());
      setSummary(await summaryRes.json());
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load policies",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const openCreateModal = () => {
    setFormState(emptyPolicyForm);
    setEditingPolicyId(null);
    setIsModalOpen(true);
  };

  const openEditModal = (policy: PolicyRecord) => {
    setFormState({
      title: policy.title,
      category: policy.category ?? "",
      summary: policy.summary ?? "",
      body: policy.body,
      tags: policy.tags.join(", "),
      exemplarIds: policy.exemplars.map((exemplar) => exemplar.id),
    });
    setEditingPolicyId(policy.id);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setFormState(emptyPolicyForm);
    setEditingPolicyId(null);
  };

  const handleFormChange = (
    field: keyof PolicyFormState,
    value: string | string[],
  ) => {
    setFormState((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handlePolicySave = async () => {
    setSavingPolicy(true);
    setError(null);
    try {
      const payload = {
        title: formState.title.trim(),
        category: formState.category.trim() || null,
        summary: formState.summary.trim() || null,
        body: formState.body,
        tags: formState.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        exemplarIds: formState.exemplarIds,
      };
      const url = editingPolicyId
        ? `/api/policies/${editingPolicyId}`
        : "/api/policies";
      const method = editingPolicyId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to save policy");
      }
      await loadAll();
      closeModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to save policy");
    } finally {
      setSavingPolicy(false);
    }
  };

  const handlePolicyDelete = async (policyId: string) => {
    if (!confirm("Delete this policy?")) {
      return;
    }
    setDeletingPolicy(policyId);
    setError(null);
    try {
      const res = await fetch(`/api/policies/${policyId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Unable to delete policy");
      }
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete policy");
    } finally {
      setDeletingPolicy(null);
    }
  };

  const handleUploadExemplar = async (formData: FormData) => {
    setUploadingExemplar(true);
    setExemplarError(null);
    try {
      const res = await fetch("/api/policies/exemplars", {
        method: "POST",
        body: formData,
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Unable to upload exemplar");
      }
      setExemplars(payload);
      await loadAll();
    } catch (err) {
      setExemplarError(
        err instanceof Error ? err.message : "Unable to upload exemplar",
      );
    } finally {
      setUploadingExemplar(false);
    }
  };

  useCopilotAction({
    name: "createPolicyRule",
    description: "Create a new contract policy rule.",
    parameters: [
      { name: "title", type: "string", required: true },
      { name: "body", type: "string", required: true },
      { name: "category", type: "string" },
      { name: "summary", type: "string" },
      { name: "tags", type: "string" },
    ],
    handler: async ({ title, body, category, summary, tags }) => {
      const res = await fetch("/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          body,
          category,
          summary,
          tags: tags ? tags.split(",").map((tag) => tag.trim()) : [],
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Unable to create policy");
      }
      await loadAll();
      return `Policy "${title}" created.`;
    },
  });

  useCopilotAction({
    name: "listPolicies",
    description: "Summarize the current contract policies.",
    handler: async () => {
      if (!policies.length) {
        return "No policies are defined yet.";
      }
      return policies
        .slice(0, 5)
        .map(
          (policy) =>
            `• ${policy.title}${
              policy.category ? ` (${policy.category})` : ""
            }: ${policy.summary ?? "no summary"}`,
        )
        .join("\n");
    },
  });

  const policyStats = useMemo(() => {
    if (!summary) return null;
    return [
      {
        label: "Policies",
        value: summary.policyCount,
        description: "Total active policy rules",
      },
      {
        label: "Exemplars",
        value: summary.exemplarCount,
        description: "Reference agreements ingested",
      },
      {
        label: "Last Update",
        value: summary.lastUpdated
          ? formatDistanceToNow(new Date(summary.lastUpdated), {
              addSuffix: true,
            })
          : "—",
        description: "Most recent policy change",
      },
    ];
  }, [summary]);

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900 lg:px-6 lg:py-8">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="space-y-4 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                Contracts Workflow
              </p>
              <h1 className="text-3xl font-semibold text-slate-900">
                Policy Management & Exemplar Library
              </h1>
              <p className="text-sm text-slate-500">
                Curate reusable policy rules and reference agreements that feed
                the contracts assistant and automated reviews.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={openCreateModal}
                className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
              >
                New Policy Rule
              </button>
            </div>
          </div>
          {error && (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">
              {error}
            </div>
          )}
          {policyStats && (
            <dl className="grid gap-4 sm:grid-cols-3">
              {policyStats.map((stat) => (
                <div
                  key={stat.label}
                  className="rounded-2xl border border-slate-100 p-4"
                >
                  <dt className="text-xs font-semibold uppercase tracking-widest text-slate-400">
                    {stat.label}
                  </dt>
                  <dd className="text-2xl font-semibold text-slate-900">
                    {stat.value}
                  </dd>
                  <p className="text-xs text-slate-500">{stat.description}</p>
                </div>
              ))}
            </dl>
          )}
        </header>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Policy Rules
              </h2>
              <p className="text-sm text-slate-500">
                Manage the guardrails referenced during agreement drafting.
              </p>
            </div>
            <button
              onClick={openCreateModal}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Add Policy
            </button>
          </div>

          {loading ? (
            <p className="mt-6 text-sm text-slate-500">Loading policies…</p>
          ) : (
            <div className="mt-6 overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead>
                  <tr className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
                    <th className="px-4 py-3 text-left">Title</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-left">Tags</th>
                    <th className="px-4 py-3 text-left">Exemplars</th>
                    <th className="px-4 py-3 text-left">Updated</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {policies.map((policy) => (
                    <tr key={policy.id}>
                      <td className="px-4 py-3 align-top">
                        <p className="font-semibold text-slate-900">
                          {policy.title}
                        </p>
                        {policy.summary && (
                          <p className="text-xs text-slate-500">
                            {policy.summary}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        {policy.category || "—"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-wrap gap-1">
                          {policy.tags.length === 0 && (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                          {policy.tags.map((tag) => (
                            <span
                              key={tag}
                              className="rounded-full border border-slate-200 px-2 py-0.5 text-xs"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col gap-1">
                          {policy.exemplars.length === 0 && (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                          {policy.exemplars.map((exemplar) => (
                            <span
                              key={exemplar.id}
                              className="text-xs text-slate-600"
                            >
                              {exemplar.title} · {exemplar.type}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-sm text-slate-500">
                        {formatDistanceToNow(new Date(policy.updated_at), {
                          addSuffix: true,
                        })}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex gap-3">
                          <button
                            onClick={() => openEditModal(policy)}
                            className="text-xs font-semibold text-slate-700 underline"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handlePolicyDelete(policy.id)}
                            disabled={deletingPolicy === policy.id}
                            className="text-xs font-semibold text-rose-600 underline disabled:opacity-50"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {policies.length === 0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-6 text-center text-sm text-slate-500"
                      >
                        No policies yet. Click “Add Policy” to create your first
                        rule.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">
                Example Agreements
              </h2>
              <p className="text-sm text-slate-500">
                Upload sample MSAs, SOWs, NDAs, or other exemplars for the
                assistant to reference.
              </p>
            </div>
          </div>
          <ExemplarUploader
            uploading={uploadingExemplar}
            error={exemplarError}
            onUpload={handleUploadExemplar}
          />
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {exemplars.map((exemplar) => (
              <article
                key={exemplar.id}
                className="rounded-2xl border border-slate-100 p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                      {exemplar.type}
                    </p>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {exemplar.title}
                    </h3>
                  </div>
                  <a
                    href={exemplar.public_url}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-slate-600 underline"
                  >
                    View
                  </a>
                </div>
                {exemplar.summary && (
                  <p className="mt-2 text-sm text-slate-500">
                    {exemplar.summary}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  Uploaded by {exemplar.uploaded_by ?? "Unknown"} ·{" "}
                  {formatDistanceToNow(new Date(exemplar.created_at), {
                    addSuffix: true,
                  })}
                </p>
              </article>
            ))}
            {exemplars.length === 0 && (
              <p className="text-sm text-slate-500">
                No exemplars yet. Upload a file above to populate the library.
              </p>
            )}
          </div>
        </section>
      </div>

      {isModalOpen && (
        <PolicyModal
          exemplars={exemplars}
          formState={formState}
          saving={savingPolicy}
          onClose={closeModal}
          onChange={handleFormChange}
          onSave={handlePolicySave}
          editing={Boolean(editingPolicyId)}
        />
      )}
    </div>
  );
}

function PolicyModal({
  exemplars,
  formState,
  saving,
  onClose,
  onChange,
  onSave,
  editing,
}: {
  exemplars: ExemplarRecord[];
  formState: PolicyFormState;
  saving: boolean;
  onClose: () => void;
  onChange: (field: keyof PolicyFormState, value: string | string[]) => void;
  onSave: () => void;
  editing: boolean;
}) {
  const toggleExemplar = (id: string) => {
    onChange(
      "exemplarIds",
      formState.exemplarIds.includes(id)
        ? formState.exemplarIds.filter((value) => value !== id)
        : [...formState.exemplarIds, id],
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {editing ? "Edit Policy" : "New Policy"}
            </p>
            <h3 className="text-2xl font-semibold text-slate-900">
              {editing ? "Update policy rule" : "Create policy rule"}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-500 transition hover:text-slate-900"
          >
            ✕
          </button>
        </div>
        <div className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Title
            </label>
            <input
              value={formState.title}
              onChange={(event) => onChange("title", event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="Example: Payment terms must follow Net 30 unless approved."
            />
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Category
              </label>
              <input
                value={formState.category}
                onChange={(event) => onChange("category", event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="Finance, Legal, Delivery…"
              />
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Tags
              </label>
              <input
                value={formState.tags}
                onChange={(event) => onChange("tags", event.target.value)}
                className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
                placeholder="comma,separated,tags"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Summary
            </label>
            <textarea
              value={formState.summary}
              onChange={(event) => onChange("summary", event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              rows={2}
              placeholder="Quick explanation for future reference."
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Body
            </label>
            <textarea
              value={formState.body}
              onChange={(event) => onChange("body", event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              rows={6}
              placeholder="Full policy details, including rationale & exceptions."
            />
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Attach Exemplars
            </label>
            <div className="mt-2 max-h-48 overflow-y-auto rounded-2xl border border-slate-200">
              {exemplars.length === 0 && (
                <p className="px-4 py-3 text-sm text-slate-500">
                  No exemplars uploaded yet.
                </p>
              )}
              {exemplars.map((exemplar) => (
                <label
                  key={exemplar.id}
                  className="flex items-start gap-3 border-b border-slate-100 px-4 py-3 last:border-none"
                >
                  <input
                    type="checkbox"
                    checked={formState.exemplarIds.includes(exemplar.id)}
                    onChange={() => toggleExemplar(exemplar.id)}
                    className="mt-1"
                  />
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {exemplar.title}
                    </p>
                    <p className="text-xs text-slate-500">{exemplar.type}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={
              saving ||
              !formState.title.trim() ||
              !formState.body.trim()
            }
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving ? "Saving…" : editing ? "Update Policy" : "Create Policy"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ExemplarUploader({
  uploading,
  error,
  onUpload,
}: {
  uploading: boolean;
  error: string | null;
  onUpload: (formData: FormData) => void;
}) {
  const [title, setTitle] = useState("");
  const [type, setType] = useState("MSA");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!file || !title.trim()) return;
    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title.trim());
    formData.append("type", type);
    formData.append("summary", summary.trim());
    formData.append("tags", tags);
    onUpload(formData);
    setTitle("");
    setSummary("");
    setTags("");
    setFile(null);
  };

  return (
    <form
      className="mt-6 grid gap-4 rounded-2xl border border-slate-100 p-4 md:grid-cols-[2fr,1fr]"
      onSubmit={handleSubmit}
    >
      <div className="space-y-3">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Exemplar Title
          </label>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="e.g., Reference MSA Template"
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Type
            </label>
            <select
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            >
              {Array.from(new Set(EXEMPLAR_TYPES)).map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Tags
            </label>
            <input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
              placeholder="comma,separated,tags"
            />
          </div>
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Summary
          </label>
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            className="mt-1 w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm"
            rows={2}
            placeholder="Optional synopsis to help reviewers."
          />
        </div>
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Upload File
          </label>
          <input
            type="file"
            onChange={(event) => {
              if (event.target.files?.[0]) {
                setFile(event.target.files[0]);
              }
            }}
            className="mt-1 text-sm"
          />
        </div>
        {error && (
          <p className="text-sm text-rose-600">
            {error}
          </p>
        )}
      </div>
      <div className="flex flex-col justify-end">
        <button
          type="submit"
          disabled={uploading || !file || !title.trim()}
          className="rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {uploading ? "Uploading…" : "Upload Exemplar"}
        </button>
        <p className="mt-2 text-xs text-slate-500">
          Files are stored in the `policy-exemplars` bucket for agent access.
        </p>
      </div>
    </form>
  );
}

