"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { useCoAgent, useCopilotAction } from "@copilotkit/react-core";
import { useCopilotContext } from "@/hooks/useCopilotContext";
import { useEstimateDetail } from "@/hooks/useEstimateDetail";
import { buildStageGateStatus } from "@/lib/stage-gates";
import StageStepper from "@/components/project-detail/StageStepper";
import TimelinePanel from "@/components/project-detail/TimelinePanel";
import LockedStagePanel from "@/components/project-detail/LockedStagePanel";
import type {
  ArtifactRecord,
  EstimateDetail,
  TimelineRecord,
  WbsRowRecord,
  WbsVersionRecord,
  QuoteDetail,
  QuoteTotals,
} from "@/lib/estimates";
import {
  calculateQuoteTotals,
  hasApprovedEffortEstimate,
} from "@/lib/estimates";
import { STAGES, getStageIndex, isFinalStage } from "@/lib/stages";
import DualPaneEditor from "@/components/editor/DualPaneEditor";

type Props = {
  estimateId: string;
};

type AgentState = {
  proverbs?: string[];
  selectedProjectId?: string | null;
  selectedProjectName?: string | null;
  selectedProjectStage?: string | null;
  timelineVersion?: string | null;
  stage_gates?: Record<string, any>;
};

type EditableWbsRow = {
  id?: string;
  taskCode: string;
  description: string;
  role: string;
  hours: number;
  assumptions: string;
};

type EditableQuoteRate = {
  role: string;
  rate: number;
};

const DEFAULT_ROLE_RATE = 150;

export default function ProjectDetailView({ estimateId }: Props) {
  // Use React Query for data fetching
  const { data: detail, isLoading: loading, error: queryError, invalidate } = useEstimateDetail(estimateId);
  const [actionError, setActionError] = useState<string | null>(null);
  const error = queryError instanceof Error ? queryError.message : queryError ? String(queryError) : null;
  const [uploading, setUploading] = useState(false);
  const [isConfirming, setIsConfirming] = useState<
    null | { type: "approve" | "advance"; label: string }
  >(null);
  const [notes, setNotes] = useState("");
  const [businessCaseDraft, setBusinessCaseDraft] = useState("");
  const [requirementsDraft, setRequirementsDraft] = useState("");
  const [solutionArchitectureDraft, setSolutionArchitectureDraft] = useState("");
  const [businessCaseSaving, setBusinessCaseSaving] = useState(false);
  const [requirementsSaving, setRequirementsSaving] = useState(false);
  const [solutionArchitectureSaving, setSolutionArchitectureSaving] = useState(false);
  const [businessCaseGenerating, setBusinessCaseGenerating] = useState(false);
  const [requirementsGenerating, setRequirementsGenerating] = useState(false);
  const [solutionArchitectureGenerating, setSolutionArchitectureGenerating] = useState(false);
  const [quoteRates, setQuoteRates] = useState<EditableQuoteRate[]>([]);
  const [quoteOverrides, setQuoteOverrides] = useState<Record<string, number>>({});
  const [paymentTerms, setPaymentTerms] = useState("");
  const [deliveryTimeline, setDeliveryTimeline] = useState("");
  const [quoteDelivered, setQuoteDelivered] = useState(false);
  const [quoteDeliveredAt, setQuoteDeliveredAt] = useState<string | null>(null);
  const [quoteSaving, setQuoteSaving] = useState(false);
  const [quoteExporting, setQuoteExporting] = useState(false);
  const [quoteCopying, setQuoteCopying] = useState(false);
  const [wbsRows, setWbsRows] = useState<EditableWbsRow[]>([]);
  const [wbsSaving, setWbsSaving] = useState(false);
  const [wbsGenerating, setWbsGenerating] = useState(false);
  const [businessCasePreviewVisible, setBusinessCasePreviewVisible] = useState(true);
  const [requirementsPreviewVisible, setRequirementsPreviewVisible] = useState(true);
  const { state: agentState, setState } = useCoAgent<AgentState>({
    name: "sample_agent",
  });
  const setStateRef = useRef(setState);
  
  // Sync copilot context for workflow awareness
  useCopilotContext(
    "estimates",
    estimateId,
    "project",
    detail ? { id: estimateId, name: detail.estimate.name, stage: detail.estimate.stage } : undefined
  );

  useEffect(() => {
    setStateRef.current = setState;
  }, [setState]);

  // Build stage gates (include local payment terms state for real-time gate checking)
  const stageGates = useMemo(
    () => buildStageGateStatus(detail ?? null, paymentTerms),
    [detail, paymentTerms],
  );

  // Update Copilot shared state with gates
  useEffect(() => {
    if (!detail) return;
    const latestTimeline = detail.timeline[0]?.id ?? null;
    setStateRef.current((prev) => ({
      ...(prev || {}),
      selectedProjectId: detail.estimate.id,
      selectedProjectName: detail.estimate.name,
      selectedProjectStage: detail.estimate.stage,
      timelineVersion: latestTimeline,
      workflow: "estimates",
      entity_id: detail.estimate.id,
      entity_type: "project",
      entity_data: {
        id: detail.estimate.id,
        name: detail.estimate.name,
        stage: detail.estimate.stage,
      },
      stage_gates: stageGates,
    }));
  }, [detail, stageGates]);

  // Invalidate query when Copilot updates stage
  useEffect(() => {
    if (!agentState) return;
    if (agentState.selectedProjectId !== estimateId) return;
    if (
      agentState.selectedProjectStage &&
      detail &&
      agentState.selectedProjectStage !== detail.estimate.stage
    ) {
      invalidate();
    }
    if (
      agentState.timelineVersion &&
      detail?.timeline[0]?.id &&
      agentState.timelineVersion !== detail.timeline[0].id
    ) {
      invalidate();
    }
  }, [
    agentState?.selectedProjectId,
    agentState?.selectedProjectStage,
    agentState?.timelineVersion,
    detail?.estimate.stage,
    detail?.timeline,
    estimateId,
    invalidate,
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

  useEffect(() => {
    if (!detail) return;
    setSolutionArchitectureDraft(detail.solutionArchitecture.content ?? "");
  }, [detail?.solutionArchitecture.content, detail]);

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

  useEffect(() => {
    if (!detail) return;
    const existingRates = detail.quote.rates.map((rate) => ({
      role: rate.role,
      rate: rate.rate,
    }));
    const roleSet = Array.from(
      new Set(
        detail.effortEstimate.rows
          .map((row) => row.role)
          .filter((role): role is string => Boolean(role)),
      ),
    );
    const mergedRates = [...existingRates];
    roleSet.forEach((role) => {
      if (!mergedRates.some((item) => item.role === role)) {
        mergedRates.push({ role, rate: DEFAULT_ROLE_RATE });
      }
    });
    setQuoteRates(mergedRates);
    const overridesMap: Record<string, number> = {};
    detail.quote.overrides.forEach((override) => {
      overridesMap[override.wbs_row_id] = override.rate;
    });
    setQuoteOverrides(overridesMap);
    setPaymentTerms(detail.quote.record.payment_terms ?? "");
    setDeliveryTimeline(detail.quote.record.delivery_timeline ?? "");
    setQuoteDelivered(detail.quote.record.delivered);
    setQuoteDeliveredAt(detail.quote.record.delivered_at ?? null);
  }, [
    detail,
    detail?.quote.record.delivered,
    detail?.quote.record.delivery_timeline,
    detail?.quote.record.payment_terms,
    detail?.effortEstimate.rows,
  ]);

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

  const quoteDetailDraft = useMemo<QuoteDetail | null>(() => {
    if (!detail) return null;
    return {
      record: {
        ...detail.quote.record,
        payment_terms: paymentTerms || null,
        delivery_timeline: deliveryTimeline || null,
        delivered: quoteDelivered,
      },
      rates: quoteRates.map((rate) => ({
        id:
          detail.quote.rates.find((existing) => existing.role === rate.role)?.id ??
          `rate-${rate.role}`,
        estimate_id: detail.estimate.id,
        role: rate.role,
        rate: Number(rate.rate) || 0,
        updated_at:
          detail.quote.rates.find((existing) => existing.role === rate.role)
            ?.updated_at ?? detail.quote.record.updated_at,
      })),
      overrides: Object.entries(quoteOverrides).map(([rowId, value]) => ({
        id: rowId,
        estimate_id: detail.estimate.id,
        wbs_row_id: rowId,
        rate: Number(value) || 0,
        updated_at:
          detail.quote.overrides.find(
            (existing) => existing.wbs_row_id === rowId,
          )?.updated_at ?? detail.quote.record.updated_at,
      })),
    };
  }, [
    detail,
    paymentTerms,
    deliveryTimeline,
    quoteDelivered,
    quoteRates,
    quoteOverrides,
  ]);

  const quoteTotals = useMemo<QuoteTotals | null>(() => {
    if (!detail || !quoteDetailDraft) return null;
    return calculateQuoteTotals(detail.effortEstimate, quoteDetailDraft);
  }, [detail, quoteDetailDraft]);

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
  const solutionArchitectureDirty =
    detail?.solutionArchitecture &&
    (solutionArchitectureDraft ?? "") !== (detail.solutionArchitecture.content ?? "") || false;

  const canApproveBusinessCase =
    extractPlainText(businessCaseDraft).length > 0 &&
    !detail?.businessCase?.approved;
  const canValidateRequirements =
    extractPlainText(requirementsDraft).length > 0 &&
    !detail?.requirements?.validated;

  const applyDetail = useCallback((payload: EstimateDetail) => {
    // React Query will handle the state update
    invalidate();
      setBusinessCaseDraft(payload.businessCase.content ?? "");
      setRequirementsDraft(payload.requirements.content ?? "");
      setSolutionArchitectureDraft(payload.solutionArchitecture.content ?? "");
      setSolutionArchitectureDraft(payload.solutionArchitecture.content ?? "");
  }, [invalidate]);

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
        const typedPayload = payload as EstimateDetail;
        // Update local WBS rows state immediately
        const generatedRows = typedPayload.effortEstimate.rows.map((row, index) =>
          mapWbsRowToEditable(row, index),
        );
        setWbsRows(generatedRows);
        // Invalidate React Query cache to refresh gates
        invalidate();
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
    [estimateId, invalidate],
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

  const handleQuoteRateChange = useCallback(
    (index: number, field: keyof EditableQuoteRate, value: string | number) => {
      setQuoteRates((prev) =>
        prev.map((rate, idx) =>
          idx === index
            ? {
                ...rate,
                [field]:
                  field === "rate"
                    ? Number(value) || 0
                    : typeof value === "string"
                    ? value
                    : rate.role,
              }
            : rate,
        ),
      );
    },
    [],
  );

  const handleAddQuoteRole = useCallback(() => {
    setQuoteRates((prev) => [
      ...prev,
      { role: "", rate: DEFAULT_ROLE_RATE },
    ]);
  }, []);

  const handleRemoveQuoteRole = useCallback((index: number) => {
    setQuoteRates((prev) => prev.filter((_, idx) => idx !== index));
  }, []);

  const handleOverrideChange = useCallback(
    (rowId: string, value: string | number) => {
      setQuoteOverrides((prev) => {
        const next = { ...prev };
        const numeric = Number(value);
        if (!value || Number.isNaN(numeric) || numeric <= 0) {
          delete next[rowId];
        } else {
          next[rowId] = numeric;
        }
        return next;
      });
    },
    [],
  );

  const buildQuotePayload = useCallback(() => {
    return {
      paymentTerms: paymentTerms.trim() || null,
      deliveryTimeline: deliveryTimeline.trim() || null,
      rates: quoteRates
        .map((rate) => ({
          role: rate.role.trim(),
          rate: Number(rate.rate) || 0,
        }))
        .filter((rate) => rate.role.length > 0 && rate.rate > 0),
      overrides: Object.entries(quoteOverrides).map(
        ([wbsRowId, rate]) => ({
          wbsRowId,
          rate,
        }),
      ),
    };
  }, [paymentTerms, deliveryTimeline, quoteRates, quoteOverrides]);

  const handleQuoteSave = useCallback(async () => {
    setQuoteSaving(true);
    setActionError(null);
    try {
      const payload = buildQuotePayload();
      const res = await fetch(`/api/estimates/${estimateId}/quote`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to save quote");
      }
      applyDetail(data as EstimateDetail);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Quote save failed");
    } finally {
      setQuoteSaving(false);
    }
  }, [applyDetail, buildQuotePayload, estimateId]);

  const handleMarkDelivered = useCallback(async () => {
    setQuoteSaving(true);
    setActionError(null);
    try {
      const payload = buildQuotePayload();
      const res = await fetch(`/api/estimates/${estimateId}/quote`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          delivered: true,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to mark delivered");
      }
      applyDetail(data as EstimateDetail);
      setNotes("");
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Unable to mark delivered",
      );
    } finally {
      setQuoteSaving(false);
    }
  }, [applyDetail, buildQuotePayload, estimateId, notes]);

  const handleReopenQuote = useCallback(async () => {
    setQuoteSaving(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/estimates/${estimateId}/quote`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          adminOverride: true,
          delivered: false,
          notes: notes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Unable to reopen quote");
      }
      applyDetail(data as EstimateDetail);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Unable to reopen");
    } finally {
      setQuoteSaving(false);
    }
  }, [applyDetail, estimateId, notes]);

  const handleExportQuote = useCallback(async () => {
    setQuoteExporting(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/estimates/${estimateId}/export`);
      if (!res.ok) {
        const payload = await res.json();
        throw new Error(payload.error || "Unable to export CSV");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `estimate-${estimateId}-quote.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Export failed");
    } finally {
      setQuoteExporting(false);
    }
  }, [estimateId]);

  const handleCopyQuote = useCallback(async () => {
    setQuoteCopying(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/estimates/${estimateId}/export`);
      const text = await res.text();
      if (!res.ok) {
        throw new Error("Unable to copy CSV");
      }
      await navigator.clipboard.writeText(text);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Copy failed");
    } finally {
      setQuoteCopying(false);
    }
  }, [estimateId]);

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

  const handleSolutionArchitectureGenerate = useCallback(
    async (triggeredBy: string) => {
      setSolutionArchitectureGenerating(true);
      setActionError(null);
      try {
        const res = await fetch(
          `/api/estimates/${estimateId}/solution-architecture/generate`,
          { method: "POST" },
        );
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.error || "Unable to generate Solution & Architecture");
        }
        applyDetail(payload as EstimateDetail);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Generation failed";
        setActionError(message);
        if (triggeredBy === "copilot") {
          throw new Error(message);
        }
      } finally {
        setSolutionArchitectureGenerating(false);
      }
    },
    [estimateId, applyDetail],
  );

  const handleSolutionArchitectureSave = useCallback(
    async (options?: { approve?: boolean; notes?: string }) => {
      setSolutionArchitectureSaving(true);
      setActionError(null);
      try {
        const res = await fetch(`/api/estimates/${estimateId}/solution-architecture`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: solutionArchitectureDraft,
            approved: options?.approve ?? false,
            approved_by: options?.approve ? "User" : undefined,
            notes: options?.notes,
          }),
        });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.error || "Unable to save Solution & Architecture");
        }
        applyDetail(payload as EstimateDetail);
        if (options?.approve) {
          setNotes("");
        }
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Save failed");
      } finally {
        setSolutionArchitectureSaving(false);
      }
    },
    [estimateId, solutionArchitectureDraft, applyDetail],
  );

  const handleStageChange = useCallback(
    async (stage: string) => {
      setActionError(null);
      try {
        const res = await fetch(`/api/estimates/${estimateId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "changeStage",
            stage: stage,
            actor: "User",
          }),
        });
        const payload = await res.json();
        if (!res.ok) {
          throw new Error(payload.error || "Unable to change stage");
        }
        applyDetail(payload as EstimateDetail);
      } catch (err) {
        setActionError(err instanceof Error ? err.message : "Failed to change stage");
      }
    },
    [estimateId, applyDetail],
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

  useCopilotAction({
    name: "getProjectTotal",
    description: "Retrieve the current total quote value for this project.",
    handler: async () => {
      const res = await fetch(`/api/estimates/${estimateId}/stage/estimate`, {
        cache: "no-store",
      });
      const payload = await res.json();
      if (!res.ok) {
        throw new Error(payload.error || "Unable to fetch total");
      }
      const currency = payload.currency ?? "USD";
      const totalCost = Number(payload.totalCost ?? 0).toFixed(2);
      return `Total quote for ${payload.projectName ?? "this project"} is ${currency} ${totalCost}`;
    },
  });

  // Direct editing actions for Copilot
  useCopilotAction({
    name: "update_business_case",
    description: "Update the Business Case content directly. Auto-saves automatically.",
    parameters: [
      { name: "content", description: "The new Business Case content (HTML)", required: true },
    ],
    handler: async ({ content }) => {
      if (!detail) {
        throw new Error("No estimate loaded");
      }
      const gates = stageGates["Business Case"];
      if (!gates?.canAccess) {
        throw new Error("Business Case is locked. Need 2+ artifacts first.");
      }
      setBusinessCaseDraft(content);
      await handleBusinessCaseSave();
      invalidate();
      return "Business Case updated and saved";
    },
  });

  useCopilotAction({
    name: "update_requirements",
    description: "Update the Requirements content directly. Auto-saves automatically.",
    parameters: [
      { name: "content", description: "The new Requirements content (HTML)", required: true },
    ],
    handler: async ({ content }) => {
      if (!detail) {
        throw new Error("No estimate loaded");
      }
      const gates = stageGates["Requirements"];
      if (!gates?.canAccess) {
        throw new Error("Requirements is locked. Business Case must be approved first.");
      }
      setRequirementsDraft(content);
      await handleRequirementsSave();
      invalidate();
      return "Requirements updated and saved";
    },
  });

  useCopilotAction({
    name: "update_quote_terms",
    description: "Update payment terms or delivery timeline for the Quote stage.",
    parameters: [
      { name: "payment_terms", description: "Payment terms (e.g., 'Net 30')" },
      { name: "delivery_timeline", description: "Delivery timeline description" },
    ],
    handler: async ({ payment_terms, delivery_timeline }) => {
      if (!detail) {
        throw new Error("No estimate loaded");
      }
      const gates = stageGates["Quote"];
      if (!gates?.canAccess) {
        throw new Error("Quote is locked. Effort Estimate must be approved first.");
      }
      if (payment_terms) {
        setPaymentTerms(payment_terms);
      }
      if (delivery_timeline) {
        setDeliveryTimeline(delivery_timeline);
      }
      await handleQuoteSave();
      invalidate();
      return "Quote terms updated and saved";
    },
  });

  // Gate-aware advance action
  useCopilotAction({
    name: "advance_stage",
    description: "Advance to the next stage if all gates are satisfied.",
    handler: async () => {
      if (!detail) {
        throw new Error("No estimate loaded");
      }
      const currentGates = stageGates[detail.estimate.stage];
      if (!currentGates?.canAdvance) {
        const blocking = currentGates?.readyToAdvance.filter((g) => !g.passed && g.blocking);
        if (blocking && blocking.length > 0) {
          throw new Error(`Cannot advance: ${blocking.map((g) => g.message).join(", ")}`);
        }
        throw new Error("Cannot advance: gates not satisfied");
      }
      await runAction("advance");
      invalidate();
      return "Stage advanced successfully";
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
        workflow: "estimates",
        entity_id: typedPayload.estimate.id,
        entity_type: "project",
        entity_data: {
          id: typedPayload.estimate.id,
          name: typedPayload.estimate.name,
          stage: typedPayload.estimate.stage,
        },
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

  const currentGates = detail ? stageGates[detail.estimate.stage] : null;

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10 text-slate-900">
      <div className="mx-auto flex max-w-7xl gap-8">
        {/* Left Pane - Sticky Stepper & Timeline */}
        <aside className="sticky top-4 h-fit w-80 space-y-6">
          <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <StageStepper
              currentStage={detail?.estimate.stage ?? ""}
              gates={stageGates}
              detail={detail}
              onStageClick={handleStageChange}
            />
          </div>
          {detail && (
            <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              <TimelinePanel timeline={detail.timeline} />
            </div>
          )}
        </aside>

        {/* Right Pane - Current Stage Panel */}
        <main className="flex-1 space-y-6">
          <header className="space-y-3 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Estimate Detail
            </p>
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h1 className="text-3xl font-semibold text-slate-900">
                  {detail?.estimate.name ?? "Loading..."}
                </h1>
                <p className="text-slate-500">
                  Owner · {detail?.estimate.owner ?? "—"} · Updated{" "}
                  {detail?.estimate.updated_at
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

          {/* Current Stage Panel */}
          {detail && (
            <section className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
              {detail.estimate.stage === "Artifacts" && (
                <ArtifactsPanel
                  artifacts={detail.artifacts}
                  onUpload={handleUpload}
                  uploading={uploading}
                  estimateId={estimateId}
                  onDetailUpdate={applyDetail}
                />
              )}

              {detail.estimate.stage === "Business Case" && (
                <>
                  {stageGates["Business Case"]?.canAccess ? (
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
                  ) : (
                    <LockedStagePanel
                      stageTitle="Business Case"
                      gateInfo={stageGates["Business Case"]}
                    />
                  )}
                </>
              )}

              {detail.estimate.stage === "Requirements" && (
                <>
                  {stageGates["Requirements"]?.canAccess ? (
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
                  ) : (
                    <LockedStagePanel
                      stageTitle="Requirements"
                      gateInfo={stageGates["Requirements"]}
                    />
                  )}
                </>
              )}

              {detail.estimate.stage === "Solution/Architecture" && (
                <>
                  {stageGates["Solution/Architecture"]?.canAccess ? (
                    <SolutionArchitecturePanel
                      draft={solutionArchitectureDraft}
                      approved={detail.solutionArchitecture.approved}
                      updatedAt={detail.solutionArchitecture.updated_at}
                      dirty={solutionArchitectureDirty ?? false}
                      saving={solutionArchitectureSaving}
                      generating={solutionArchitectureGenerating}
                      canApprove={
                        solutionArchitectureDraft.trim().length > 0 &&
                        !detail.solutionArchitecture.approved
                      }
                      onChange={setSolutionArchitectureDraft}
                      onGenerate={() => handleSolutionArchitectureGenerate("user")}
                      onSave={() => handleSolutionArchitectureSave()}
                      onApprove={() =>
                        handleSolutionArchitectureSave({
                          approve: true,
                          notes: notes.trim() || undefined,
                        })
                      }
                    />
                  ) : (
                    <LockedStagePanel
                      stageTitle="Solution/Architecture"
                      gateInfo={stageGates["Solution/Architecture"]}
                    />
                  )}
                </>
              )}

              {detail.estimate.stage === "Effort Estimate" && (
                <>
                  {stageGates["Effort Estimate"]?.canAccess ? (
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
                  ) : (
                    <LockedStagePanel
                      stageTitle="Effort Estimate"
                      gateInfo={stageGates["Effort Estimate"]}
                    />
                  )}
                </>
              )}

              {detail.estimate.stage === "Quote" && (
                <>
                  {stageGates["Quote"]?.canAccess ? (
                    <QuotePanel
                      rows={detail.effortEstimate.rows}
                      roleRates={quoteRates}
                      overrides={quoteOverrides}
                      paymentTerms={paymentTerms}
                      deliveryTimeline={deliveryTimeline}
                      delivered={quoteDelivered}
                      deliveredAt={quoteDeliveredAt}
                      totals={quoteTotals}
                      saving={quoteSaving}
                      exporting={quoteExporting}
                      copying={quoteCopying}
                      disabled={quoteDelivered}
                      canDeliver={
                        Boolean(quoteTotals && quoteTotals.lines.length > 0) &&
                        hasApprovedWbs &&
                        !quoteDelivered
                      }
                      hasQuoteData={Boolean(quoteTotals && quoteTotals.lines.length > 0)}
                      onRateChange={handleQuoteRateChange}
                      onAddRole={handleAddQuoteRole}
                      onRemoveRole={handleRemoveQuoteRole}
                      onOverrideChange={handleOverrideChange}
                      onPaymentTermsChange={setPaymentTerms}
                      onDeliveryTimelineChange={setDeliveryTimeline}
                      onSave={handleQuoteSave}
                      onDeliver={handleMarkDelivered}
                      onReopen={handleReopenQuote}
                      onExport={handleExportQuote}
                      onCopy={handleCopyQuote}
                    />
                  ) : (
                    <LockedStagePanel
                      stageTitle="Quote"
                      gateInfo={stageGates["Quote"]}
                    />
                  )}
                </>
              )}
            </section>
          )}
        </main>
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
        <div className="h-[500px]">
          <DualPaneEditor
            value={draft}
            onChange={onChange}
            templateType="business-case"
            previewVisible={true}
            onPreviewToggle={() => {}}
          />
        </div>
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

type SolutionArchitecturePanelProps = {
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

function SolutionArchitecturePanel({
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
}: SolutionArchitecturePanelProps) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-100">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">
            Solution & Architecture
          </h2>
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
        Document the proposed implementation approach, technical stack, and key risks. Generate with Copilot or write manually, then approve to unlock the Effort Estimate stage.
      </p>
      <div className="mt-4 space-y-3">
        <div className="h-[500px]">
          <DualPaneEditor
            value={draft}
            onChange={onChange}
            templateType="business-case"
            previewVisible={true}
            onPreviewToggle={() => {}}
          />
        </div>
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
            {saving && canApprove ? "Approving…" : "Approve Solution & Architecture"}
          </button>
        </div>
      </div>
    </div>
  );
}

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
        <div className="h-[500px]">
          <DualPaneEditor
            value={draft}
            onChange={onChange}
            templateType="requirements"
            previewVisible={true}
            onPreviewToggle={() => {}}
          />
        </div>
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

type QuotePanelProps = {
  rows: WbsRowRecord[];
  roleRates: EditableQuoteRate[];
  overrides: Record<string, number>;
  paymentTerms: string;
  deliveryTimeline: string;
  delivered: boolean;
  deliveredAt: string | null;
  totals: QuoteTotals | null;
  saving: boolean;
  exporting: boolean;
  copying: boolean;
  disabled: boolean;
  canDeliver: boolean;
  hasQuoteData: boolean;
  onRateChange: (
    index: number,
    field: keyof EditableQuoteRate,
    value: string | number,
  ) => void;
  onAddRole: () => void;
  onRemoveRole: (index: number) => void;
  onOverrideChange: (rowId: string, value: string | number) => void;
  onPaymentTermsChange: (value: string) => void;
  onDeliveryTimelineChange: (value: string) => void;
  onSave: () => void;
  onDeliver: () => void;
  onReopen: () => void;
  onExport: () => void;
  onCopy: () => void;
};

function QuotePanel({
  rows,
  roleRates,
  overrides,
  paymentTerms,
  deliveryTimeline,
  delivered,
  deliveredAt,
  totals,
  saving,
  exporting,
  copying,
  disabled,
  canDeliver,
  hasQuoteData,
  onRateChange,
  onAddRole,
  onRemoveRole,
  onOverrideChange,
  onPaymentTermsChange,
  onDeliveryTimelineChange,
  onSave,
  onDeliver,
  onReopen,
  onExport,
  onCopy,
}: QuotePanelProps) {
  const roleRateMap = new Map(
    roleRates.map((rate) => [rate.role.toLowerCase(), Number(rate.rate) || 0]),
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Quote Stage
          </p>
          <h2 className="text-2xl font-semibold text-slate-900">
            Pricing & Delivery
          </h2>
          <p className="text-sm text-slate-500">
            Configure role rates, override per-task costs, set payment terms, and
            export the final quote artifact.
          </p>
        </div>
        <div className="rounded-2xl bg-slate-900 px-4 py-3 text-white shadow-inner">
          <p className="text-xs uppercase tracking-widest text-white/70">
            Total
          </p>
          <p className="text-2xl font-semibold">
            {totals
              ? `${totals.currency} ${totals.totalCost.toFixed(2)}`
              : "—"}
          </p>
          {delivered && deliveredAt && (
            <p className="text-xs text-white/70">
              Delivered {new Date(deliveredAt).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            delivered
              ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
              : "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
          }`}
        >
          {delivered ? "Delivered" : "Draft"}
        </span>
        {!delivered && (
          <button
            onClick={onSave}
            disabled={saving}
            className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save Quote"}
          </button>
        )}
        {!delivered && (
          <button
            onClick={onDeliver}
            disabled={!canDeliver || saving}
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {saving ? "Marking…" : "Mark Delivered"}
          </button>
        )}
        {delivered && (
          <button
            onClick={onReopen}
            disabled={saving}
            className="rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Reopening…" : "Reopen Quote (Admin Override)"}
          </button>
        )}
        <button
          onClick={onExport}
          disabled={!hasQuoteData || exporting}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {exporting ? "Exporting…" : "Export CSV"}
        </button>
        <button
          onClick={onCopy}
          disabled={!hasQuoteData || copying}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {copying ? "Copying…" : "Copy CSV"}
        </button>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Payment Terms
          </label>
          <PaymentTermsSelector
            value={paymentTerms}
            onChange={onPaymentTermsChange}
            disabled={disabled}
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Delivery Timeline
          </label>
          <textarea
            value={deliveryTimeline}
            onChange={(event) => onDeliveryTimelineChange(event.target.value)}
            disabled={disabled}
            placeholder="e.g., Delivery within 8 weeks of kickoff."
            className="w-full rounded-2xl border border-slate-200 p-3 text-sm"
          />
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Role Rates
          </h3>
          {!disabled && (
            <button
              onClick={onAddRole}
              className="rounded-full border border-dashed border-slate-300 px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              + Add Role
            </button>
          )}
        </div>
        <div className="divide-y divide-slate-200">
          {roleRates.length === 0 && (
            <p className="px-4 py-4 text-sm text-slate-500">
              No roles yet. Add a rate to begin.
            </p>
          )}
          {roleRates.map((rate, index) => (
            <div
              key={`${rate.role}-${index}`}
              className="grid gap-3 px-4 py-3 md:grid-cols-[2fr,1fr,auto]"
            >
              <input
                value={rate.role}
                disabled={disabled}
                onChange={(event) =>
                  onRateChange(index, "role", event.target.value)
                }
                placeholder="Role"
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="number"
                min={0}
                step={5}
                value={rate.rate}
                disabled={disabled}
                onChange={(event) =>
                  onRateChange(index, "rate", Number(event.target.value))
                }
                className="rounded-xl border border-slate-200 px-3 py-2 text-sm"
              />
              {!disabled && (
                <button
                  onClick={() => onRemoveRole(index)}
                  className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-50"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200">
        <div className="border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            WBS Overrides
          </h3>
          <p className="text-xs text-slate-500">
            Optional per-task rates supersede the role rate for final costing.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr className="text-xs uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3 text-left">Task</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Hours</th>
                <th className="px-4 py-3 text-left">Override Rate</th>
                <th className="px-4 py-3 text-left">Effective Rate</th>
                <th className="px-4 py-3 text-left">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row, index) => {
                const hasPersistedRow = Boolean(row.id);
                const overrideKey = hasPersistedRow
                  ? (row.id as string)
                  : `temp-${index}`;
                const overrideRate = overrides[overrideKey] ?? null;
                const resolvedRate =
                  overrideRate ??
                  roleRateMap.get((row.role ?? "").toLowerCase()) ??
                  DEFAULT_ROLE_RATE;
                const cost = (row.hours ?? 0) * resolvedRate;
                return (
                  <tr key={overrideKey}>
                    <td className="px-4 py-3 align-top">
                      <p className="font-medium text-slate-900">
                        {row.task_code ?? "—"}
                      </p>
                      <p className="text-xs text-slate-500">
                        {row.description}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">{row.role}</td>
                    <td className="px-4 py-3 align-top">
                      {(row.hours ?? 0).toFixed(2)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <input
                        type="number"
                        min={0}
                        step={5}
                        value={overrideRate ?? ""}
                        disabled={disabled || !hasPersistedRow}
                        onChange={(event) =>
                          hasPersistedRow &&
                          onOverrideChange(row.id as string, event.target.value)
                        }
                        placeholder="Use role rate"
                        className="w-32 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </td>
                    <td className="px-4 py-3 align-top">
                      {resolvedRate.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {cost.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-6 text-center text-sm text-slate-500"
                  >
                    Approve a WBS to configure quote overrides.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
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
  estimateId,
  onDetailUpdate,
}: {
  artifacts: ArtifactRecord[];
  onUpload: (files: FileList | null) => void;
  uploading: boolean;
  estimateId: string;
  onDetailUpdate: (detail: EstimateDetail) => void;
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
        {artifacts.map((artifact) => {
          const extract = artifact.extract;
          const ext = artifact.filename.split(".").pop()?.toLowerCase();
          const isExtractable = ext === "md" || ext === "docx";
          const status = extract?.extraction_status || (isExtractable ? "pending" : null);
          
          return (
            <li key={artifact.id} className="flex items-center justify-between py-3">
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="font-medium text-slate-900">{artifact.filename}</p>
                  {isExtractable && status && (
                    <ExtractionStatusBadge status={status} />
                  )}
                </div>
                <p className="text-xs text-slate-500">
                  Uploaded {formatDistanceToNow(new Date(artifact.created_at), { addSuffix: true })} ·{" "}
                  {artifact.size_bytes
                    ? `${(artifact.size_bytes / 1024).toFixed(0)} KB`
                    : "—"}
                  {extract?.extraction_status === "ready" && extract.content_text && (
                    <span className="ml-2">· Text extracted</span>
                  )}
                </p>
                {extract?.extraction_status === "ready" && extract.summary && (
                  <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                    {extract.summary}
                  </p>
                )}
                {extract?.extraction_status === "failed" && extract.error_message && (
                  <p className="mt-1 text-xs text-rose-600">
                    Error: {extract.error_message}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                {extract?.extraction_status === "failed" && (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(
                          `/api/estimates/${estimateId}/artifacts/extract`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ artifactId: artifact.id }),
                          },
                        );
                        if (res.ok) {
                          // Refresh the detail to show updated status
                          const detailRes = await fetch(`/api/estimates/${estimateId}`);
                          if (detailRes.ok) {
                            const detail = await detailRes.json();
                            onDetailUpdate(detail);
                          }
                        }
                      } catch (err) {
                        console.error("Failed to retry extraction:", err);
                      }
                    }}
                    className="text-xs font-medium text-slate-700 underline hover:text-slate-900"
                  >
                    Retry
                  </button>
                )}
                <a
                  href={artifact.public_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-slate-700 underline"
                >
                  View
                </a>
              </div>
            </li>
          );
        })}
        {artifacts.length === 0 && (
          <li className="py-4 text-sm text-slate-500">
            No artifacts uploaded yet.
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

const PAYMENT_TERMS_OPTIONS = [
  { value: "", label: "Select payment terms..." },
  { value: "Net 15", label: "Net 15" },
  { value: "Net 30", label: "Net 30" },
  { value: "Net 45", label: "Net 45" },
  { value: "Net 60", label: "Net 60" },
  { value: "Custom", label: "Custom..." },
];

function ExtractionStatusBadge({ status }: { status: string }) {
  const styles = {
    pending: "bg-slate-100 text-slate-600",
    processing: "bg-amber-100 text-amber-700",
    ready: "bg-emerald-100 text-emerald-700",
    failed: "bg-rose-100 text-rose-700",
  };
  
  const labels = {
    pending: "Pending",
    processing: "Processing",
    ready: "Ready",
    failed: "Failed",
  };
  
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${styles[status as keyof typeof styles] || styles.pending}`}
    >
      {labels[status as keyof typeof labels] || status}
    </span>
  );
}

function PaymentTermsSelector({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  const isCustom = value && !PAYMENT_TERMS_OPTIONS.some((opt) => opt.value === value && opt.value !== "Custom");
  const [customValue, setCustomValue] = useState(value && isCustom ? value : "");
  const [showCustomInput, setShowCustomInput] = useState(isCustom);

  const handleSelectChange = (selectedValue: string) => {
    if (selectedValue === "Custom") {
      setShowCustomInput(true);
      onChange(customValue);
    } else {
      setShowCustomInput(false);
      onChange(selectedValue);
    }
  };

  const handleCustomInputChange = (inputValue: string) => {
    setCustomValue(inputValue);
    onChange(inputValue);
  };

  // Sync custom value when external value changes
  useEffect(() => {
    if (value && !PAYMENT_TERMS_OPTIONS.some((opt) => opt.value === value && opt.value !== "Custom")) {
      setCustomValue(value);
      setShowCustomInput(true);
    } else if (value && PAYMENT_TERMS_OPTIONS.some((opt) => opt.value === value)) {
      setShowCustomInput(false);
    }
  }, [value]);

  return (
    <div className="space-y-2">
      <select
        value={showCustomInput ? "Custom" : value || ""}
        onChange={(e) => handleSelectChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-2xl border border-slate-200 p-3 text-sm"
      >
        {PAYMENT_TERMS_OPTIONS.map((option) => (
          <option key={option.value || "empty"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {showCustomInput && (
        <input
          type="text"
          value={customValue}
          onChange={(e) => handleCustomInputChange(e.target.value)}
          disabled={disabled}
          placeholder="Enter custom payment terms..."
          className="w-full rounded-2xl border border-slate-200 p-3 text-sm"
        />
      )}
    </div>
  );
}

