import type { EstimateDetail } from "./estimates";

export type StageEstimateResponse = {
  estimateId: string;
  projectName: string;
  currentStage: string;
  totalHours: number;
  roleSummary: Record<string, number>;
  approvedVersion?: {
    version: number;
    actor: string | null;
    created_at: string;
    notes: string | null;
  } | null;
  rows: {
    id: string;
    task_code: string | null;
    description: string;
    role: string;
    hours: number;
    assumptions: string | null;
    sort_order: number;
    updated_at: string;
  }[];
  lastUpdated: string | null;
};

export function buildStageEstimatePayload(
  detail: EstimateDetail,
): StageEstimateResponse {
  const rows = detail.effortEstimate.rows ?? [];
  const totalHours = rows.reduce((sum, row) => sum + (row.hours ?? 0), 0);
  const roleSummary = rows.reduce((acc, row) => {
    if (!row.role) return acc;
    acc[row.role] = (acc[row.role] ?? 0) + (row.hours ?? 0);
    return acc;
  }, {} as Record<string, number>);
  const approvedVersion = detail.effortEstimate.approvedVersion
    ? {
        version: detail.effortEstimate.approvedVersion.version_number,
        actor: detail.effortEstimate.approvedVersion.actor,
        created_at: detail.effortEstimate.approvedVersion.created_at,
        notes: detail.effortEstimate.approvedVersion.notes,
      }
    : null;
  const lastUpdated =
    rows[rows.length - 1]?.updated_at ?? detail.estimate.updated_at ?? null;

  return {
    estimateId: detail.estimate.id,
    projectName: detail.estimate.name,
    currentStage: detail.estimate.stage,
    totalHours,
    roleSummary,
    approvedVersion,
    rows,
    lastUpdated,
  };
}

