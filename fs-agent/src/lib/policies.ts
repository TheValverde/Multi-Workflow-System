import type { SupabaseClient } from "@supabase/supabase-js";
import { getPolicyExemplarPublicUrl } from "./storage";

export type ContractPolicy = {
  id: string;
  title: string;
  category: string | null;
  summary: string | null;
  body: string;
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type ContractExemplar = {
  id: string;
  title: string;
  type: string;
  summary: string | null;
  storage_path: string;
  tags: string[];
  uploaded_by: string | null;
  created_at: string;
  updated_at: string;
  public_url: string;
};

export type PolicyWithExemplars = ContractPolicy & {
  exemplars: ContractExemplar[];
};

export type PolicyPayload = {
  title: string;
  category?: string | null;
  summary?: string | null;
  body: string;
  tags?: string[];
  exemplarIds?: string[];
};

export type PolicySummary = {
  policyCount: number;
  exemplarCount: number;
  lastUpdated: string | null;
};

const POLICY_SELECT = `
  id,title,category,summary,body,tags,created_at,updated_at,
  contract_policy_exemplars (
    exemplar:contract_exemplars (
      id,title,type,summary,storage_path,tags,uploaded_by,created_at,updated_at
    )
  )
`;

export function normalizeTags(tags?: unknown): string[] {
  if (!tags) return [];
  if (Array.isArray(tags)) {
    return tags
      .map((tag) => String(tag).trim())
      .filter((tag) => tag.length > 0);
  }
  if (typeof tags === "string") {
    return tags
      .split(",")
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0);
  }
  return [];
}

export async function fetchPolicies(
  supabase: SupabaseClient,
): Promise<PolicyWithExemplars[]> {
  const { data, error } = await supabase
    .from("contract_policies")
    .select(POLICY_SELECT)
    .order("updated_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []).map((row) => mapPolicyRow(supabase, row));
}

export async function fetchPolicyById(
  supabase: SupabaseClient,
  id: string,
): Promise<PolicyWithExemplars | null> {
  const { data, error } = await supabase
    .from("contract_policies")
    .select(POLICY_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (!data) return null;
  return mapPolicyRow(supabase, data);
}

export async function createPolicy(
  supabase: SupabaseClient,
  payload: PolicyPayload,
): Promise<PolicyWithExemplars> {
  const tags = normalizeTags(payload.tags);
  const { data, error } = await supabase
    .from("contract_policies")
    .insert({
      title: payload.title.trim(),
      category: payload.category?.trim() || null,
      summary: payload.summary?.trim() || null,
      body: payload.body,
      tags,
    })
    .select(POLICY_SELECT)
    .single();
  if (error) {
    throw error;
  }
  const policy = mapPolicyRow(supabase, data);
  if (payload.exemplarIds?.length) {
    await syncPolicyExemplars(supabase, policy.id, payload.exemplarIds);
    return (await fetchPolicyById(supabase, policy.id)) ?? policy;
  }
  return policy;
}

export async function updatePolicy(
  supabase: SupabaseClient,
  id: string,
  payload: PolicyPayload,
): Promise<PolicyWithExemplars> {
  const tags = normalizeTags(payload.tags);
  const updatePayload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (payload.title !== undefined) {
    updatePayload.title = payload.title.trim();
  }
  if (payload.category !== undefined) {
    updatePayload.category = payload.category?.trim() || null;
  }
  if (payload.summary !== undefined) {
    updatePayload.summary = payload.summary?.trim() || null;
  }
  if (payload.body !== undefined) {
    updatePayload.body = payload.body;
  }
  if (payload.tags !== undefined) {
    updatePayload.tags = tags;
  }
  const { error } = await supabase
    .from("contract_policies")
    .update(updatePayload)
    .eq("id", id);
  if (error) {
    throw error;
  }
  if (payload.exemplarIds) {
    await syncPolicyExemplars(supabase, id, payload.exemplarIds);
  }
  const policy = await fetchPolicyById(supabase, id);
  if (!policy) {
    throw new Error("Policy not found after update");
  }
  return policy;
}

export async function deletePolicy(
  supabase: SupabaseClient,
  id: string,
): Promise<void> {
  const { error } = await supabase
    .from("contract_policies")
    .delete()
    .eq("id", id);
  if (error) {
    throw error;
  }
}

export async function fetchExemplars(
  supabase: SupabaseClient,
): Promise<ContractExemplar[]> {
  const { data, error } = await supabase
    .from("contract_exemplars")
    .select(
      "id,title,type,summary,storage_path,tags,uploaded_by,created_at,updated_at",
    )
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (
    data?.map((row) => ({
      ...row,
      tags: row.tags ?? [],
      public_url: getPolicyExemplarPublicUrl(supabase, row.storage_path),
    })) ?? []
  );
}

export async function fetchPolicySummary(
  supabase: SupabaseClient,
): Promise<PolicySummary> {
  const { count: policyCount } = await supabase
    .from("contract_policies")
    .select("id", { count: "exact", head: true });
  const { count: exemplarCount } = await supabase
    .from("contract_exemplars")
    .select("id", { count: "exact", head: true });
  const { data: latestPolicy } = await supabase
    .from("contract_policies")
    .select("updated_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return {
    policyCount: policyCount ?? 0,
    exemplarCount: exemplarCount ?? 0,
    lastUpdated: latestPolicy?.updated_at ?? null,
  };
}

export async function syncPolicyExemplars(
  supabase: SupabaseClient,
  policyId: string,
  exemplarIds: string[],
) {
  const { data, error } = await supabase
    .from("contract_policy_exemplars")
    .select("exemplar_id")
    .eq("policy_id", policyId);
  if (error) {
    throw error;
  }
  const existing = new Set((data ?? []).map((row) => row.exemplar_id));
  const target = new Set(exemplarIds);
  const toDelete = Array.from(existing).filter((id) => !target.has(id));
  const toInsert = exemplarIds.filter((id) => !existing.has(id));
  if (toDelete.length) {
    await supabase
      .from("contract_policy_exemplars")
      .delete()
      .eq("policy_id", policyId)
      .in("exemplar_id", toDelete);
  }
  if (toInsert.length) {
    const rows = toInsert.map((exemplarId) => ({
      policy_id: policyId,
      exemplar_id: exemplarId,
    }));
    const { error: insertError } = await supabase
      .from("contract_policy_exemplars")
      .insert(rows);
    if (insertError) {
      throw insertError;
    }
  }
}

function mapPolicyRow(
  supabase: SupabaseClient,
  row: any,
): PolicyWithExemplars {
  const policy: ContractPolicy = {
    id: row.id,
    title: row.title,
    category: row.category,
    summary: row.summary,
    body: row.body,
    tags: row.tags ?? [],
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
  const exemplars: ContractExemplar[] = (row.contract_policy_exemplars ?? [])
    .map((link: any) => link.exemplar)
    .filter(Boolean)
    .map((exemplar: any) => ({
      ...exemplar,
      tags: exemplar.tags ?? [],
      public_url: getPolicyExemplarPublicUrl(
        supabase,
        exemplar.storage_path,
      ),
    }));
  return {
    ...policy,
    exemplars,
  };
}

