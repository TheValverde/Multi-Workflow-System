import type { SupabaseClient } from "@supabase/supabase-js";

export const ARTIFACT_BUCKET = "estimate-artifacts";
export const POLICY_EXEMPLAR_BUCKET = "policy-exemplars";
export const CONTRACT_DRAFTS_BUCKET = "contract-drafts";

export function getArtifactPublicUrl(
  supabase: SupabaseClient,
  storagePath: string,
): string {
  const { data } = supabase.storage
    .from(ARTIFACT_BUCKET)
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

export function getPolicyExemplarPublicUrl(
  supabase: SupabaseClient,
  storagePath: string,
): string {
  const { data } = supabase.storage
    .from(POLICY_EXEMPLAR_BUCKET)
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

