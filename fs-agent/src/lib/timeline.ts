import type { SupabaseClient } from "@supabase/supabase-js";

export async function logTimelineEntry(
  supabase: SupabaseClient,
  estimateId: string,
  stage: string,
  action: string,
  actor: string,
  notes?: string,
) {
  const { error } = await supabase.from("estimate_timeline").insert({
    estimate_id: estimateId,
    stage,
    action,
    actor,
    notes: notes ?? null,
  });
  if (error) {
    throw error;
  }
}

