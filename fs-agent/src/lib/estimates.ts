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

