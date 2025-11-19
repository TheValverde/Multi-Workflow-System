import type { SupabaseClient } from "@supabase/supabase-js";
import { ARTIFACT_BUCKET, getArtifactPublicUrl } from "./storage";

export type EstimateDetail = {
  estimate: {
    id: string;
    name: string;
    owner: string;
    stage: string;
    updated_at: string | null;
  };
  artifacts: ArtifactRecord[];
  timeline: TimelineRecord[];
  businessCase: BusinessCaseRecord;
  requirements: RequirementsRecord;
  effortEstimate: EffortEstimateRecord;
};

export type ArtifactRecord = {
  id: string;
  filename: string;
  storage_path: string;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
  public_url: string;
};

export type TimelineRecord = {
  id: string;
  stage: string;
  action: string;
  actor: string;
  notes: string | null;
  created_at: string;
};

export type BusinessCaseRecord = {
  id: string;
  estimate_id: string;
  content: string | null;
  approved: boolean;
  approved_by: string | null;
  updated_at: string;
};

export type RequirementsRecord = {
  id: string;
  estimate_id: string;
  content: string | null;
  validated: boolean;
  validated_by: string | null;
  updated_at: string;
};

export type WbsRowRecord = {
  id: string;
  estimate_id: string;
  task_code: string | null;
  description: string;
  role: string;
  hours: number;
  assumptions: string | null;
  sort_order: number;
  updated_at: string;
};

export type WbsVersionRecord = {
  id: string;
  estimate_id: string;
  version_number: number;
  actor: string | null;
  approved: boolean;
  notes: string | null;
  snapshot: any;
  created_at: string;
};

export type EffortEstimateRecord = {
  rows: WbsRowRecord[];
  versions: WbsVersionRecord[];
  approvedVersion: WbsVersionRecord | null;
};

export type WbsRowInput = {
  id?: string | null;
  taskCode?: string | null;
  description: string;
  role: string;
  hours: number;
  assumptions?: string | null;
};

export async function fetchEstimateDetail(
  supabase: SupabaseClient,
  estimateId: string,
): Promise<EstimateDetail | null> {
  const { data: estimate, error: estimateError } = await supabase
    .from("estimates")
    .select("id,name,owner,stage,updated_at")
    .eq("id", estimateId)
    .maybeSingle();

  if (estimateError || !estimate) {
    return null;
  }

  const [
    { data: artifacts },
    { data: timeline },
    businessCase,
    requirements,
    wbsRows,
    wbsVersions,
  ] = await Promise.all([
    supabase
      .from("estimate_artifacts")
      .select("id,filename,storage_path,size_bytes,uploaded_by,created_at")
      .eq("estimate_id", estimateId)
      .order("created_at", { ascending: false }),
    supabase
      .from("estimate_timeline")
      .select("id,stage,action,actor,notes,created_at")
      .eq("estimate_id", estimateId)
      .order("created_at", { ascending: false }),
    ensureBusinessCaseRow(supabase, estimateId),
    ensureRequirementsRow(supabase, estimateId),
    getWbsRows(supabase, estimateId),
    getWbsVersions(supabase, estimateId),
  ]);

  const mappedArtifacts: ArtifactRecord[] =
    artifacts?.map((artifact) => ({
      ...artifact,
      public_url: getArtifactPublicUrl(supabase, artifact.storage_path),
    })) ?? [];

  return {
    estimate,
    artifacts: mappedArtifacts,
    timeline: timeline ?? [],
    businessCase,
    requirements,
    effortEstimate: buildEffortEstimate(wbsRows, wbsVersions),
  };
}

export async function countArtifacts(
  supabase: SupabaseClient,
  estimateId: string,
): Promise<number> {
  const { count } = await supabase
    .from("estimate_artifacts")
    .select("*", { count: "exact", head: true })
    .eq("estimate_id", estimateId);
  return count ?? 0;
}

export const artifactBucketName = ARTIFACT_BUCKET;

async function ensureBusinessCaseRow(
  supabase: SupabaseClient,
  estimateId: string,
): Promise<BusinessCaseRecord> {
  const { data, error } = await supabase
    .from("estimate_business_case")
    .select("id,estimate_id,content,approved,approved_by,updated_at")
    .eq("estimate_id", estimateId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (data) {
    return data as BusinessCaseRecord;
  }
  const { data: inserted, error: insertError } = await supabase
    .from("estimate_business_case")
    .insert({ estimate_id: estimateId })
    .select("id,estimate_id,content,approved,approved_by,updated_at")
    .single();
  if (insertError) {
    throw insertError;
  }
  return inserted as BusinessCaseRecord;
}

async function ensureRequirementsRow(
  supabase: SupabaseClient,
  estimateId: string,
): Promise<RequirementsRecord> {
  const { data, error } = await supabase
    .from("estimate_requirements")
    .select("id,estimate_id,content,validated,validated_by,updated_at")
    .eq("estimate_id", estimateId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (data) {
    return data as RequirementsRecord;
  }
  const { data: inserted, error: insertError } = await supabase
    .from("estimate_requirements")
    .insert({ estimate_id: estimateId })
    .select("id,estimate_id,content,validated,validated_by,updated_at")
    .single();
  if (insertError) {
    throw insertError;
  }
  return inserted as RequirementsRecord;
}

export async function upsertBusinessCase(
  supabase: SupabaseClient,
  estimateId: string,
  update: Partial<Pick<BusinessCaseRecord, "content" | "approved" | "approved_by">>,
) {
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (update.content !== undefined) {
    payload.content = update.content;
  }
  if (update.approved !== undefined) {
    payload.approved = update.approved;
  }
  if (update.approved_by !== undefined) {
    payload.approved_by = update.approved_by;
  }
  const { data, error } = await supabase
    .from("estimate_business_case")
    .update(payload)
    .eq("estimate_id", estimateId)
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return data as BusinessCaseRecord;
}

export async function upsertRequirements(
  supabase: SupabaseClient,
  estimateId: string,
  update: Partial<Pick<RequirementsRecord, "content" | "validated" | "validated_by">>,
) {
  const payload: Record<string, any> = {
    updated_at: new Date().toISOString(),
  };
  if (update.content !== undefined) {
    payload.content = update.content;
  }
  if (update.validated !== undefined) {
    payload.validated = update.validated;
  }
  if (update.validated_by !== undefined) {
    payload.validated_by = update.validated_by;
  }
  const { data, error } = await supabase
    .from("estimate_requirements")
    .update(payload)
    .eq("estimate_id", estimateId)
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return data as RequirementsRecord;
}

async function getWbsRows(
  supabase: SupabaseClient,
  estimateId: string,
): Promise<WbsRowRecord[]> {
  const { data, error } = await supabase
    .from("estimate_wbs_rows")
    .select(
      "id,estimate_id,task_code,description,role,hours,assumptions,sort_order,updated_at",
    )
    .eq("estimate_id", estimateId)
    .order("sort_order", { ascending: true });
  if (error) {
    throw error;
  }
  return (
    data?.map((row) => ({
      ...row,
      hours: typeof row.hours === "number" ? row.hours : Number(row.hours) || 0,
    })) ?? []
  );
}

async function getWbsVersions(
  supabase: SupabaseClient,
  estimateId: string,
): Promise<WbsVersionRecord[]> {
  const { data, error } = await supabase
    .from("estimate_wbs_versions")
    .select(
      "id,estimate_id,version_number,actor,approved,notes,snapshot,created_at",
    )
    .eq("estimate_id", estimateId)
    .order("version_number", { ascending: false });
  if (error) {
    throw error;
  }
  return data ?? [];
}

export async function replaceWbsRows(
  supabase: SupabaseClient,
  estimateId: string,
  rows: WbsRowInput[],
) {
  const { error: deleteError } = await supabase
    .from("estimate_wbs_rows")
    .delete()
    .eq("estimate_id", estimateId);
  if (deleteError) {
    throw deleteError;
  }
  if (!rows.length) {
    return;
  }
  const payload = rows.map((row, index) => ({
    estimate_id: estimateId,
    task_code: row.taskCode ?? `TASK-${index + 1}`,
    description: row.description,
    role: row.role,
    hours: Number(row.hours) || 0,
    assumptions: row.assumptions ?? null,
    sort_order: index,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await supabase
    .from("estimate_wbs_rows")
    .insert(payload, { returning: "minimal" });
  if (error) {
    throw error;
  }
}

export async function createWbsVersion(
  supabase: SupabaseClient,
  estimateId: string,
  actor: string,
  notes?: string,
) {
  const rows = await getWbsRows(supabase, estimateId);
  const { data: latest } = await supabase
    .from("estimate_wbs_versions")
    .select("version_number")
    .eq("estimate_id", estimateId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextVersion = (latest?.version_number ?? 0) + 1;
  const { error } = await supabase.from("estimate_wbs_versions").insert({
    estimate_id: estimateId,
    version_number: nextVersion,
    actor,
    approved: true,
    notes: notes ?? null,
    snapshot: rows,
  });
  if (error) {
    throw error;
  }
}

function buildEffortEstimate(
  rows: WbsRowRecord[],
  versions: WbsVersionRecord[],
): EffortEstimateRecord {
  const approvedVersion = versions.find((version) => version.approved) ?? null;
  return {
    rows,
    versions,
    approvedVersion,
  };
}

export function hasApprovedEffortEstimate(
  effortEstimate: EffortEstimateRecord | null | undefined,
): boolean {
  if (!effortEstimate) return false;
  return Boolean(effortEstimate.approvedVersion);
}

