"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useCoAgent, useCopilotAction } from "@copilotkit/react-core";
import type {
  ArtifactRecord,
  EstimateDetail,
  TimelineRecord,
  WbsRowRecord,
  WbsVersionRecord,
} from "@/lib/estimates";
import { hasApprovedEffortEstimate } from "@/lib/estimates";
import { STAGES, getStageIndex, isFinalStage } from "@/lib/stages";
import RichTextEditor from "@/components/project-detail/RichTextEditor";

type Props = {
  estimateId: string;
};

type AgentState = {
  proverbs?: string[];
  selectedProjectId?: string | null;
  selectedProjectName?: string | null;
  selectedProjectStage?: string | null;
  timelineVersion?: string | null;
};

type EditableWbsRow = {
  id?: string;
  taskCode: string;
  description: string;
  role: string;
  hours: number;
  assumptions: string;
};

export default function ProjectDetailView({ estimateId }: Props) {
  const [detail, setDetail] = useState<EstimateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState<
    null | { type: "approve" | "advance"; label: string }
  >(null);
  const [notes, setNotes] = useState("");
  const [businessCaseDraft, setBusinessCaseDraft] = useState("");
  const [requirementsDraft, setRequirementsDraft] = useState("");
  const [businessCaseSaving, setBusinessCaseSaving] = useState(false);
  const [requirementsSaving, setRequirementsSaving] = useState(false);
  const [businessCaseGenerating, setBusinessCaseGenerating] = useState(false);
  const [requirementsGenerating, setRequirementsGenerating] = useState(false);
  const [wbsRows, setWbsRows] = useState<EditableWbsRow[]>([]);
  const [wbsSaving, setWbsSaving] = useState(false);
  const [wbsGenerating, setWbsGenerating] = useState(false);
  const { state: agentState, setState } = useCoAgent<AgentState>({
    name: "sample_agent",
  });
  const setStateRef = useRef(setState);

  useEffect(() => {
    setStateRef.current = setState;
  }, [setState]);

  const loadDetail = useCallback(
    async (options?: { silent?: boolean }) => {
      const silent = options?.silent ?? false;
      if (!silent) {
        setLoading(true);
        setError(null);
      }
      try {
        const res = await fetch(`/api/estimates/${estimateId}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          throw new Error("Unable to load estimate detail");
        }
        const payload = (await res.json()) as EstimateDetail;
        setDetail(payload);
        const latestTimeline = payload.timeline[0]?.id ?? null;
        setStateRef.current((prev) => ({
          ...(prev || {}),
          selectedProjectId: payload.estimate.id,
          selectedProjectName: payload.estimate.name,
          selectedProjectStage: payload.estimate.stage,
          timelineVersion: latestTimeline,
        }));
      } catch (err) {
        if (!silent) {
          setError(err instanceof Error ? err.message : "Unexpected error");
        } else {
          console.error("[project-detail] Silent refresh failed", err);
        }
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [estimateId],
  );

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!cancelled) {
        await loadDetail();
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [loadDetail]);

  const currentTimelineVersion = detail?.timeline[0]?.id ?? null;

  useEffect(() => {
    if (!agentState) return;
    if (agentState.selectedProjectId !== estimateId) return;
    if (
      agentState.selectedProjectStage &&
      detail &&
      agentState.selectedProjectStage !== detail.estimate.stage
    ) {
      loadDetail({ silent: true });
      return;
    }
    if (
      agentState.timelineVersion &&
      currentTimelineVersion &&
      agentState.timelineVersion !== currentTimelineVersion
    ) {
      loadDetail({ silent: true });
    }
  }, [
    agentState?.selectedProjectId,
    agentState?.selectedProjectStage,
    agentState?.timelineVersion,
    currentTimelineVersion,
    detail?.estimate.stage,
    estimateId,
    loadDetail,
  ]);

  const currentStage = detail?.estimate.stage ?? "";
  const currentStageIndex = useMemo(
    () => getStageIndex(currentStage),
    [currentStage],
  );

  useEffect(() => {
    if (!detail) return;
    setBusinessCaseDraft(detail.businessCase.content ?? "");
  }, [detail?.businessCase.content, detail]);

  useEffect(() => {
    if (!detail) return;
    setRequirementsDraft(detail.requirements.content ?? "");
  }, [detail?.requirements.content, detail]);

  const serverWbsRows = useMemo(
    () =>
      detail?.effortEstimate.rows.map((row, index) =>
        mapWbsRowToEditable(row, index),
      ) ?? [],
    [detail?.effortEstimate.rows],
  );

  useEffect(() => {
    setWbsRows(serverWbsRows);
  }, [serverWbsRows]);

  const wbsDirty = useMemo(
    () => !areWbsRowsEqual(wbsRows, serverWbsRows),
    [wbsRows, serverWbsRows],
  );

  const hasApprovedWbs = hasApprovedEffortEstimate(detail?.effortEstimate);
  const wbsVersions = detail?.effortEstimate.versions ?? [];
  const approvedWbsVersion = detail?.effortEstimate.approvedVersion ?? null;

  const wbsTotalHours = useMemo(
    () => wbsRows.reduce((sum, row) => sum + (Number(row.hours) || 0), 0),
    [wbsRows],
  );

  const wbsRoleSummary = useMemo(() => {
    return wbsRows.reduce((acc, row) => {
      if (!row.role) return acc;
      acc[row.role] = (acc[row.role] ?? 0) + (Number(row.hours) || 0);
      return acc;
    }, {} as Record<string, number>);
  }, [wbsRows]);

  const wbsRowsRef = useRef<EditableWbsRow[]>([]);

  useEffect(() => {
    wbsRowsRef.current = wbsRows;
  }, [wbsRows]);

  const stageReady = useMemo(() => {
    if (!detail) return false;
    switch (detail.estimate.stage) {
      case "Artifacts":
        return detail.artifacts.length >= 2;
      case "Business Case":
        return detail.businessCase.approved;
      case "Requirements":
        return detail.requirements.validated;
      case "Effort Estimate":
        return hasApprovedWbs;
      default:
        return true;
    }
  }, [
    detail,
    detail?.artifacts.length,
    detail?.businessCase.approved,
    detail?.requirements.validated,
    hasApprovedWbs,
  ]);

  const canAdvance =
    detail && !isFinalStage(detail.estimate.stage) && stageReady;

  const businessCaseDirty =
    detail?.businessCase &&
    (businessCaseDraft ?? "") !== (detail.businessCase.content ?? "");
  const requirementsDirty =
    detail?.requirements &&
    (requirementsDraft ?? "") !== (detail.requirements.content ?? "");

  const canApproveBusinessCase =
    extractPlainText(businessCaseDraft).length > 0 &&
    !detail?.businessCase?.approved;
  const canValidateRequirements =
    extractPlainText(requirementsDraft).length > 0 &&
    !detail?.requirements?.validated;

  const applyDetail = useCallback((payload: EstimateDetail) => {
    setDetail(payload);
    setBusinessCaseDraft(payload.businessCase.content ?? "");
    setRequirementsDraft(payload.requirements.content ?? "");
  }, []);

  const handleBusinessCaseGenerate = useCallback(
    async (source: "user" | "copilot" = "user") => {
      setBusinessCaseGenerating(true);
      setActionError(null);
      try {
        const res = await fetch(
          `/api/estimates/${estimateId}/business-case/generate`,
          {
            method: "POST",
          },
        );
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.error || "Unable to generate Business Case");
        }
        applyDetail(payload as EstimateDetail);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Generation failed";
        setActionError(message);
        if (source === "copilot") {
          throw new Error(message);
        }
      } finally {
        setBusinessCaseGenerating(false);
      }
    },
    [estimateId, applyDetail],
  );

  const handleRequirementsGenerate = useCallback(
    async (source: "user" | "copilot" = "user") => {
      setRequirementsGenerating(true);
      setActionError(null);
      try {
        const res = await fetch(
          `/api/estimates/${estimateId}/requirements/generate`,
          {
            method: "POST",
          },
        );
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.error || "Unable to generate Requirements");
        }
        applyDetail(payload as EstimateDetail);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Generation failed";
        setActionError(message);
        if (source === "copilot") {
          throw new Error(message);
        }
      } finally {
        setRequirementsGenerating(false);
      }
    },
    [estimateId, applyDetail],
  );

  const saveWbsRows = useCallback(
    async (
      rows: EditableWbsRow[],
      options?: { approve?: boolean; notes?: string },
    ) => {
      setWbsSaving(true);
      setActionError(null);
      try {
        const res = await fetch(`/api/estimates/${estimateId}/effort`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rows: rows.map((row) => ({
              id: row.id,
              taskCode: row.taskCode,
              description: row.description,
              role: row.role,
              hours: Number(row.hours) || 0,
              assumptions: row.assumptions || null,
            })),
            approve: options?.approve ?? false,
            notes: options?.notes,
          }),
        });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.error || "Unable to save WBS");
        }
        applyDetail(payload as EstimateDetail);
        if (options?.approve) {
          setNotes("");
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "WBS save failed");
        throw err;
      } finally {
        setWbsSaving(false);
      }
    },
    [estimateId, applyDetail],
  );

  const wbsSaveRef = useRef(saveWbsRows);

  useEffect(() => {
    wbsSaveRef.current = saveWbsRows;
  }, [saveWbsRows]);

  const handleWbsGenerate = useCallback(
    async (source: "user" | "copilot" = "user") => {
      setWbsGenerating(true);
      setActionError(null);
      try {
        const res = await fetch(`/api/estimates/${estimateId}/effort/generate`, {
          method: "POST",
        });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.error || "Unable to generate WBS");
        }
        applyDetail(payload as EstimateDetail);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Generation failed";
        setActionError(message);
        if (source === "copilot") {
          throw new Error(message);
        }
      } finally {
        setWbsGenerating(false);
      }
    },
    [estimateId, applyDetail],
  );

  const handleWbsSave = useCallback(
    () => saveWbsRows(wbsRows),
    [saveWbsRows, wbsRows],
  );

  const handleWbsApprove = useCallback(
    () =>
      saveWbsRows(wbsRows, {
        approve: true,
        notes: notes.trim() || undefined,
      }),
    [saveWbsRows, wbsRows, notes],
  );

  const handleWbsRowChange = useCallback(
    (index: number, field: keyof EditableWbsRow, value: string | number) => {
      setWbsRows((prev) =>
        prev.map((row, idx) =>
          idx === index
            ? {
                ...row,
                [field]:
                  field === "hours"
                    ? Number(value) || 0
                    : typeof value === "string"
                    ? value
                    : value,
              }
            : row,
        ),
      );
    },
    [],
  );

  const handleRemoveWbsRow = useCallback((index: number) => {
    setWbsRows((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleAddWbsRow = useCallback(() => {
    setWbsRows((prev) => [
      ...prev,
      {
        id: undefined,
        taskCode: `TASK-${String(prev.length + 1).padStart(3, "0")}`,
        description: "",
        role: "",
        hours: 1,
        assumptions: "",
      },
    ]);
  }, []);

  const canApproveWbs = wbsRows.length >= 5;

  const triggerWbsGenerate = useCallback(() => {
    handleWbsGenerate("user").catch(() => undefined);
  }, [handleWbsGenerate]);

  const triggerWbsSave = useCallback(() => {
    handleWbsSave().catch(() => undefined);
  }, [handleWbsSave]);

  const triggerWbsApprove = useCallback(() => {
    handleWbsApprove().catch(() => undefined);
  }, [handleWbsApprove]);

  const handleBusinessCaseSave = useCallback(
    async (options?: { approve?: boolean; notes?: string }) => {
      setBusinessCaseSaving(true);
      setActionError(null);
      try {
        const res = await fetch(`/api/estimates/${estimateId}/business-case`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: businessCaseDraft,
            approve: options?.approve ?? false,
            notes: options?.notes,
          }),
        });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.error || "Unable to save Business Case");
        }
        applyDetail(payload as EstimateDetail);
        if (options?.approve) {
          setNotes("");
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setBusinessCaseSaving(false);
      }
    },
    [estimateId, businessCaseDraft, applyDetail],
  );

  const handleRequirementsSave = useCallback(
    async (options?: { validate?: boolean; notes?: string }) => {
      setRequirementsSaving(true);
      setActionError(null);
      try {
        const res = await fetch(`/api/estimates/${estimateId}/requirements`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: requirementsDraft,
            validate: options?.validate ?? false,
            notes: options?.notes,
          }),
        });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.error || "Unable to save Requirements");
        }
        applyDetail(payload as EstimateDetail);
        if (options?.validate) {
          setNotes("");
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setRequirementsSaving(false);
      }
    },
    [estimateId, requirementsDraft, applyDetail],
  );

  useCopilotAction({
    name: "generateBusinessCase",
    description:
      "Summarize current artifacts into a polished Business Case narrative.",
    handler: async () => {
      await handleBusinessCaseGenerate("copilot");
      return "Business Case draft updated";
    },
  });

  useCopilotAction({
    name: "generateRequirements",
    description:
      "Translate project artifacts into a Requirements checklist.",
    handler: async () => {
      await handleRequirementsGenerate("copilot");
      return "Requirements draft updated";
    },
  });

  useCopilotAction({
    name: "addWbsLineItem",
    description:
      "Add a new Work Breakdown Structure line item with hours and role.",
    parameters: [
      { name: "taskCode", description: "Optional task identifier" },
      { name: "description", description: "Task summary", required: true },
      { name: "role", description: "Role responsible", required: true },
      {
        name: "hours",
        description: "Estimated hours for this task",
        required: true,
      },
      { name: "assumptions", description: "Key assumptions for the task" },
    ],
    handler: async ({ taskCode, description, role, hours, assumptions }) => {
      const nextRows: EditableWbsRow[] = [
        ...wbsRowsRef.current,
        {
          id: undefined,
          taskCode:
            taskCode ||
            `TASK-${String(wbsRowsRef.current.length + 1).padStart(3, "0")}`,
          description,
          role,
          hours: Number(hours) || 0,
          assumptions: assumptions ?? "",
        },
      ];
      await wbsSaveRef.current?.(nextRows);
      return `Added ${description} to the WBS`;
    },
  });

  useCopilotAction({
    name: "adjustWbsHours",
    description: "Update the hours for an existing WBS task code.",
    parameters: [
      { name: "taskCode", description: "Task identifier", required: true },
      {
        name: "hours",
        description: "New hour total for the task",
        required: true,
      },
    ],
    handler: async ({ taskCode, hours }) => {
      const targetIndex = wbsRowsRef.current.findIndex(
        (row) =>
          row.taskCode?.toLowerCase() === (taskCode as string).toLowerCase(),
      );
      if (targetIndex === -1) {
        throw new Error(`Task ${taskCode} not found in WBS`);
      }
      const nextRows = wbsRowsRef.current.map((row, index) =>
        index === targetIndex ? { ...row, hours: Number(hours) || 0 } : row,
      );
      await wbsSaveRef.current?.(nextRows);
      return `Updated ${taskCode} to ${hours} hours`;
    },
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const formData = new FormData();
    Array.from(files).forEach((file) => formData.append("files", file));
    formData.append("uploadedBy", "Demo User");
    setUploading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/estimates/${estimateId}/artifacts`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || "Failed to upload artifacts");
      }
      const payload = (await res.json()) as EstimateDetail;
      applyDetail(payload);
      const latestTimeline = payload.timeline[0]?.id ?? null;
      setStateRef.current((prev) => ({
        ...(prev || {}),
        selectedProjectStage: payload.estimate.stage,
        timelineVersion: latestTimeline,
      }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const runAction = async (action: "approve" | "advance") => {
    setActionError(null);
    try {
      const res = await fetch(`/api/estimates/${estimateId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          notes: notes.trim() || undefined,
          actor: "Demo User",
        }),
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Unable to perform action");
      }
      const typedPayload = payload as EstimateDetail;
      applyDetail(typedPayload);
      setNotes("");
      setStateRef.current((prev) => ({
        ...(prev || {}),
        selectedProjectStage: typedPayload.estimate.stage,
        timelineVersion: typedPayload.timeline[0]?.id ?? null,
      }));
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setIsConfirming(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-12 text-center text-slate-500">
        Loading project detail…
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="min-h-screen bg-slate-50 px-6 py-12 text-center text-rose-500">
        {error || "Project not found."}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="space-y-3 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Estimate Detail
          </p>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-900">
                {detail.estimate.name}
              </h1>
              <p className="text-slate-500">
                Owner · {detail.estimate.owner} · Updated{" "}
                {detail.estimate.updated_at
                  ? formatDistanceToNow(new Date(detail.estimate.updated_at), {
                      addSuffix: true,
                    })
                  : "—"}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() =>
                  setIsConfirming({ type: "approve", label: "Approve Stage" })
                }
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Approve Stage
              </button>
              <button
                onClick={() =>
                  setIsConfirming({ type: "advance", label: "Advance Stage" })
                }
                disabled={!canAdvance}
                className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                Advance Stage
              </button>
            </div>
          </div>
          {actionError && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-600">
              {actionError}
            </div>
          )}
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Add notes for the next action (optional)"
            className="w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none ring-slate-300 focus:border-slate-400 focus:ring-2"
          />
        </header>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <StageStepper currentStageIndex={currentStageIndex} />
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <BusinessCasePanel
            draft={businessCaseDraft}
            approved={detail.businessCase.approved}
            updatedAt={detail.businessCase.updated_at}
            dirty={Boolean(businessCaseDirty)}
            saving={businessCaseSaving}
            generating={businessCaseGenerating}
            canApprove={canApproveBusinessCase}
            onChange={setBusinessCaseDraft}
            onGenerate={() => handleBusinessCaseGenerate("user")}
            onSave={() => handleBusinessCaseSave()}
            onApprove={() =>
              handleBusinessCaseSave({
                approve: true,
                notes: notes.trim() || undefined,
              })
            }
          />
          <RequirementsPanel
            draft={requirementsDraft}
            validated={detail.requirements.validated}
            updatedAt={detail.requirements.updated_at}
            dirty={Boolean(requirementsDirty)}
            saving={requirementsSaving}
            generating={requirementsGenerating}
            canValidate={canValidateRequirements}
            onChange={setRequirementsDraft}
            onGenerate={() => handleRequirementsGenerate("user")}
            onSave={() => handleRequirementsSave()}
            onValidate={() =>
              handleRequirementsSave({
                validate: true,
                notes: notes.trim() || undefined,
              })
            }
          />
        </section>

        <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
          <EffortEstimatePanel
            rows={wbsRows}
            totalHours={wbsTotalHours}
            roleSummary={wbsRoleSummary}
            versions={wbsVersions}
            approvedVersion={approvedWbsVersion}
            dirty={wbsDirty}
            saving={wbsSaving}
            generating={wbsGenerating}
            hasApproved={hasApprovedWbs}
            canApprove={canApproveWbs}
            onGenerate={triggerWbsGenerate}
            onSave={triggerWbsSave}
            onApprove={triggerWbsApprove}
            onAddRow={handleAddWbsRow}
            onRowChange={handleWbsRowChange}
            onRemoveRow={handleRemoveWbsRow}
          />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <ArtifactsPanel
            artifacts={detail.artifacts}
            onUpload={handleUpload}
            uploading={uploading}
          />
          <TimelinePanel timeline={detail.timeline} />
        </section>
      </div>

      {isConfirming && (
        <ConfirmationDialog
          title={isConfirming.label}
          description={`Are you sure you want to ${
            isConfirming.type === "advance" ? "advance" : "approve"
          } this stage?`}
          onCancel={() => setIsConfirming(null)}
          onConfirm={() => runAction(isConfirming.type)}
        />
      )}
    </div>
  );
}

function StageStepper({ currentStageIndex }: { currentStageIndex: number }) {
  return (
    <ol className="grid gap-4 md:grid-cols-6">
      {STAGES.map((stage, index) => {
        const status =
          index < currentStageIndex
            ? "complete"
            : index === currentStageIndex
            ? "current"
            : "locked";
        return (
          <li
            key={stage.key}
            className={`rounded-2xl border p-4 ${
              status === "current"
                ? "border-slate-900 bg-slate-900 text-white"
                : status === "complete"
                ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border-slate-100 bg-slate-50 text-slate-400"
            }`}
          >
            <p className="text-xs uppercase tracking-widest">
              {index + 1 < 10 ? `0${index + 1}` : index + 1}
            </p>
            <h3 className="text-lg font-semibold">{stage.title}</h3>
            <p className="text-sm opacity-80">{stage.description}</p>
          </li>
        );
      })}
    </ol>
  );
}

type BusinessCasePanelProps = {
  draft: string;
  approved: boolean;
  updatedAt: string | null;
  dirty: boolean;
  saving: boolean;
  generating: boolean;
  canApprove: boolean;
  onChange: (value: string) => void;
  onGenerate: () => void;
  onSave: () => void;
  onApprove: () => void;
};

function BusinessCasePanel({
  draft,
  approved,
  updatedAt,
  dirty,
  saving,
  generating,
  canApprove,
  onChange,
  onGenerate,
  onSave,
  onApprove,
}: BusinessCasePanelProps) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Business Case</h2>
          <p className="text-sm text-slate-500">
            {approved ? "Approved" : "Needs approval"} · Updated{" "}
            {updatedAt
              ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true })
              : "—"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            approved
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
              : "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
          }`}
        >
          {approved ? "Approved" : "Pending review"}
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-500">
        Generate a draft with Copilot, edit inline, then approve to unlock the
        Requirements stage.
      </p>
      <div className="mt-4 space-y-3">
        <RichTextEditor value={draft} onChange={onChange} />
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onGenerate}
            disabled={generating}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? "Generating…" : "Generate with Copilot"}
          </button>
          <button
            onClick={onSave}
            disabled={!dirty || saving}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && !canApprove ? "Saving…" : "Save Draft"}
          </button>
          <button
            onClick={onApprove}
            disabled={!canApprove || saving}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving && canApprove ? "Approving…" : "Approve Business Case"}
          </button>
        </div>
      </div>
    </div>
  );
}

type RequirementsPanelProps = {
  draft: string;
  validated: boolean;
  updatedAt: string | null;
  dirty: boolean;
  saving: boolean;
  generating: boolean;
  canValidate: boolean;
  onChange: (value: string) => void;
  onGenerate: () => void;
  onSave: () => void;
  onValidate: () => void;
};

function RequirementsPanel({
  draft,
  validated,
  updatedAt,
  dirty,
  saving,
  generating,
  canValidate,
  onChange,
  onGenerate,
  onSave,
  onValidate,
}: RequirementsPanelProps) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Requirements
          </h2>
          <p className="text-sm text-slate-500">
            {validated ? "Validated" : "Awaiting validation"} · Updated{" "}
            {updatedAt
              ? formatDistanceToNow(new Date(updatedAt), { addSuffix: true })
              : "—"}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            validated
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
              : "bg-sky-50 text-sky-700 ring-1 ring-sky-100"
          }`}
        >
          {validated ? "Validated" : "Needs validation"}
        </span>
      </div>
      <p className="mt-3 text-sm text-slate-500">
        Copilot drafts requirements from the uploaded artifacts. Validate to
        unlock the downstream stages.
      </p>
      <div className="mt-4 space-y-3">
        <RichTextEditor value={draft} onChange={onChange} />
        <div className="flex flex-wrap gap-3">
          <button
            onClick={onGenerate}
            disabled={generating}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {generating ? "Generating…" : "Generate with Copilot"}
          </button>
          <button
            onClick={onSave}
            disabled={!dirty || saving}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving && !canValidate ? "Saving…" : "Save Draft"}
          </button>
          <button
            onClick={onValidate}
            disabled={!canValidate || saving}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving && canValidate ? "Validating…" : "Validate Requirements"}
          </button>
        </div>
      </div>
    </div>
  );
}

type EffortEstimatePanelProps = {
  rows: EditableWbsRow[];
  totalHours: number;
  roleSummary: Record<string, number>;
  versions: WbsVersionRecord[];
  approvedVersion: WbsVersionRecord | null;
  dirty: boolean;
  saving: boolean;
  generating: boolean;
  hasApproved: boolean;
  canApprove: boolean;
  onGenerate: () => void;
  onSave: () => void;
  onApprove: () => void;
  onAddRow: () => void;
  onRowChange: (
    index: number,
    field: keyof EditableWbsRow,
    value: string | number,
  ) => void;
  onRemoveRow: (index: number) => void;
};

function EffortEstimatePanel({
  rows,
  totalHours,
  roleSummary,
  versions,
  approvedVersion,
  dirty,
  saving,
  generating,
  hasApproved,
  canApprove,
  onGenerate,
  onSave,
  onApprove,
  onAddRow,
  onRowChange,
  onRemoveRow,
}: EffortEstimatePanelProps) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Effort Estimate · WBS
          </h2>
          <p className="text-sm text-slate-500">
            Generate, edit, and approve the work breakdown structure feeding the
            Quote and Contracts stages.
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            hasApproved
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
              : "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
          }`}
        >
          {hasApproved ? "Approved" : "Awaiting approval"}
        </span>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onGenerate}
          disabled={generating}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {generating ? "Generating…" : "Generate WBS"}
        </button>
        <button
          onClick={onSave}
          disabled={!dirty || saving}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving && !canApprove ? "Saving…" : "Save Draft"}
        </button>
        <button
          onClick={onApprove}
          disabled={!canApprove || saving}
          className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {saving && canApprove ? "Approving…" : "Approve Effort Estimate"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-widest text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left">Task Code</th>
              <th className="px-4 py-3 text-left">Description</th>
              <th className="px-4 py-3 text-left">Role</th>
              <th className="px-4 py-3 text-left">Hours</th>
              <th className="px-4 py-3 text-left">Assumptions</th>
              <th className="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={`${row.taskCode}-${index}`}>
                <td className="px-4 py-3 align-top">
                  <input
                    value={row.taskCode}
                    onChange={(event) =>
                      onRowChange(index, "taskCode", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="TASK-001"
                  />
                </td>
                <td className="px-4 py-3 align-top">
                  <textarea
                    value={row.description}
                    onChange={(event) =>
                      onRowChange(index, "description", event.target.value)
                    }
                    className="min-h-[60px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Describe the task outcome"
                  />
                </td>
                <td className="px-4 py-3 align-top">
                  <input
                    value={row.role}
                    onChange={(event) =>
                      onRowChange(index, "role", event.target.value)
                    }
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Role"
                  />
                </td>
                <td className="px-4 py-3 align-top">
                  <input
                    type="number"
                    min={0}
                    value={row.hours}
                    onChange={(event) =>
                      onRowChange(index, "hours", Number(event.target.value))
                    }
                    className="w-24 rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </td>
                <td className="px-4 py-3 align-top">
                  <textarea
                    value={row.assumptions}
                    onChange={(event) =>
                      onRowChange(index, "assumptions", event.target.value)
                    }
                    className="min-h-[60px] w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                    placeholder="Outline dependencies or risks"
                  />
                </td>
                <td className="px-4 py-3 align-top">
                  <button
                    onClick={() => onRemoveRow(index)}
                    className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-6 text-center text-sm text-slate-500"
                >
                  No WBS rows yet. Generate with Copilot or add a manual line
                  item to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={onAddRow}
          className="rounded-full border border-dashed border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        >
          + Add Line Item
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Hours Summary
          </h3>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {totalHours}h
          </p>
          <ul className="mt-3 space-y-1 text-sm text-slate-600">
            {Object.keys(roleSummary).length === 0 && (
              <li>No role allocations yet.</li>
            )}
            {Object.entries(roleSummary).map(([role, hours]) => (
              <li key={role}>
                <span className="font-medium text-slate-900">{role}</span> ·{" "}
                {hours}h
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-2xl border border-slate-100 p-4">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Version History
          </h3>
          {approvedVersion ? (
            <p className="mt-2 text-sm text-slate-600">
              Latest approval by{" "}
              <span className="font-medium text-slate-900">
                {approvedVersion.actor ?? "Unknown"}
              </span>{" "}
              on {new Date(approvedVersion.created_at).toLocaleString()}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              No approved versions yet.
            </p>
          )}
          <ul className="mt-3 space-y-2">
            {versions.slice(0, 5).map((version) => (
              <li
                key={version.id}
                className="rounded-xl border border-slate-100 px-3 py-2 text-xs text-slate-600"
              >
                <div className="font-semibold text-slate-900">
                  Version {version.version_number} ·{" "}
                  {version.approved ? "Approved" : "Draft"}
                </div>
                <div>
                  {version.actor ?? "Unknown"} ·{" "}
                  {new Date(version.created_at).toLocaleString()}
                </div>
                {version.notes && (
                  <p className="text-slate-500">{version.notes}</p>
                )}
              </li>
            ))}
            {versions.length === 0 && (
              <li className="rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-500">
                Version history will appear after the first approval.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}

function mapWbsRowToEditable(
  row: WbsRowRecord,
  index: number,
): EditableWbsRow {
  return {
    id: row.id,
    taskCode:
      row.task_code ?? `TASK-${String(index + 1).padStart(3, "0")}`,
    description: row.description ?? "",
    role: row.role ?? "",
    hours: Number(row.hours) || 0,
    assumptions: row.assumptions ?? "",
  };
}

function areWbsRowsEqual(
  current: EditableWbsRow[],
  baseline: EditableWbsRow[],
): boolean {
  if (current.length !== baseline.length) return false;
  const normalize = (rows: EditableWbsRow[]) =>
    rows.map((row) => ({
      taskCode: row.taskCode,
      description: row.description,
      role: row.role,
      hours: Number(row.hours) || 0,
      assumptions: row.assumptions,
    }));
  return JSON.stringify(normalize(current)) === JSON.stringify(normalize(baseline));
}

function extractPlainText(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ArtifactsPanel({
  artifacts,
  onUpload,
  uploading,
}: {
  artifacts: ArtifactRecord[];
  onUpload: (files: FileList | null) => void;
  uploading: boolean;
}) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Artifacts</h2>
          <p className="text-sm text-slate-500">
            {artifacts.length >= 2
              ? "Ready for advance"
              : "Upload at least two files to unlock stage advancement."}
          </p>
        </div>
        <label className="cursor-pointer rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
          {uploading ? "Uploading…" : "Upload Files"}
          <input
            type="file"
            className="hidden"
            multiple
            onChange={(event) => onUpload(event.target.files)}
            disabled={uploading}
          />
        </label>
      </div>
      <ul className="mt-4 divide-y divide-slate-100">
        {artifacts.map((artifact) => (
          <li key={artifact.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium text-slate-900">{artifact.filename}</p>
              <p className="text-xs text-slate-500">
                Uploaded {formatDistanceToNow(new Date(artifact.created_at), { addSuffix: true })} ·{" "}
                {artifact.size_bytes
                  ? `${(artifact.size_bytes / 1024).toFixed(0)} KB`
                  : "—"}
              </p>
            </div>
            <a
              href={artifact.public_url}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-slate-700 underline"
            >
              View
            </a>
          </li>
        ))}
        {artifacts.length === 0 && (
          <li className="py-4 text-sm text-slate-500">
            No artifacts uploaded yet.
          </li>
        )}
      </ul>
    </div>
  );
}

function TimelinePanel({ timeline }: { timeline: TimelineRecord[] }) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <h2 className="text-xl font-semibold text-slate-900">Timeline</h2>
      <p className="text-sm text-slate-500">
        Every approval and advance is captured for auditability.
      </p>
      <ul className="mt-4 space-y-4">
        {timeline.map((entry) => (
          <li key={entry.id} className="rounded-2xl border border-slate-100 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {new Date(entry.created_at).toLocaleString()}
            </p>
            <p className="text-sm font-semibold text-slate-900">
              {entry.actor} · {entry.action}
            </p>
            {entry.notes && (
              <p className="text-sm text-slate-500">{entry.notes}</p>
            )}
          </li>
        ))}
        {timeline.length === 0 && (
          <li className="rounded-2xl border border-slate-100 p-4 text-sm text-slate-500">
            No timeline events yet. Approvals and advances will appear here.
          </li>
        )}
      </ul>
    </div>
  );
}

function ConfirmationDialog({
  title,
  description,
  onConfirm,
  onCancel,
}: {
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-xl">
        <h3 className="text-xl font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800"
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}

