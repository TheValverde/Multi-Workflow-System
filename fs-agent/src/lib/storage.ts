import type { SupabaseClient } from "@supabase/supabase-js";

export const ARTIFACT_BUCKET = "estimate-artifacts";

export function getArtifactPublicUrl(
  supabase: SupabaseClient,
  storagePath: string,
): string {
  const { data } = supabase.storage
    .from(ARTIFACT_BUCKET)
    .getPublicUrl(storagePath);
  return data.publicUrl;
}

