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

  const [{ data: artifacts }, { data: timeline }] = await Promise.all([
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

