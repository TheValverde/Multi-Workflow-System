import type { SupabaseClient } from "@supabase/supabase-js";

export type AgreementType = "MSA" | "SOW" | "NDA" | "Addendum";

export type AgreementRecord = {
  id: string;
  type: AgreementType;
  counterparty: string;
  content: string;
  content_html?: string | null;
  content_text?: string | null;
  last_auto_saved_at?: string | null;
  auto_save_version?: number | null;
  current_version: number;
  linked_estimate_id: string | null;
  ready_for_signature: boolean;
  signature_override_rationale: string | null;
  created_at: string;
  updated_at: string;
};

export type AgreementVersion = {
  id: string;
  agreement_id: string;
  version_number: number;
  content: string;
  created_by: string | null;
  notes: string | null;
  created_at: string;
};

export type AgreementNote = {
  id: string;
  agreement_id: string;
  version_id: string | null;
  note_text: string;
  created_by: string | null;
  created_at: string;
};

export type ReviewDraft = {
  id: string;
  agreement_id: string;
  storage_path: string;
  content: string | null;
  uploaded_by: string | null;
  created_at: string;
};

export type AgreementDetail = AgreementRecord & {
  versions: AgreementVersion[];
  notes: AgreementNote[];
  linked_estimate: {
    id: string;
    name: string;
    stage: string;
  } | null;
  ready_for_signature?: boolean;
  signature_override_rationale?: string | null;
};

export type AgreementPayload = {
  type?: AgreementType;
  counterparty?: string;
  content?: string;
  linked_estimate_id?: string | null;
  ready_for_signature?: boolean;
  signature_override_rationale?: string | null;
};

export type ReviewProposal = {
  id: string;
  before: string;
  after: string;
  rationale: string;
  section?: string;
};

export type ReviewResponse = {
  proposals: ReviewProposal[];
  summary: string;
};

export type VersionPayload = {
  content: string;
  notes?: string;
  created_by?: string;
  proposals_applied?: string[]; // IDs of accepted proposals
};

export type DiscrepancySeverity = "error" | "warning" | "info";

export type Discrepancy = {
  id: string;
  category: "scope" | "hours" | "payment_terms" | "rates" | "timeline";
  severity: DiscrepancySeverity;
  message: string;
  reference?: string; // Reference to offending clause/task
  expected?: string;
  actual?: string;
};

export type ValidationResult = {
  valid: boolean;
  discrepancies: Discrepancy[];
  summary: string;
  validated_at: string;
  validated_by?: string;
};

export async function fetchAgreements(
  supabase: SupabaseClient,
): Promise<AgreementRecord[]> {
  const { data, error } = await supabase
    .from("contract_agreements")
    .select("*")
    .order("updated_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []) as AgreementRecord[];
}

export async function fetchAgreementById(
  supabase: SupabaseClient,
  id: string,
): Promise<AgreementDetail | null> {
  const { data: agreement, error: agreementError } = await supabase
    .from("contract_agreements")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (agreementError) {
    throw agreementError;
  }
  if (!agreement) {
    return null;
  }

  const { data: versions, error: versionsError } = await supabase
    .from("contract_versions")
    .select("*")
    .eq("agreement_id", id)
    .order("version_number", { ascending: false });
  if (versionsError) {
    throw versionsError;
  }

  const { data: notes, error: notesError } = await supabase
    .from("contract_notes")
    .select("*")
    .eq("agreement_id", id)
    .order("created_at", { ascending: false });
  if (notesError) {
    throw notesError;
  }

  let linked_estimate = null;
  if (agreement.linked_estimate_id) {
    const { data: estimate, error: estimateError } = await supabase
      .from("estimates")
      .select("id, name, stage")
      .eq("id", agreement.linked_estimate_id)
      .maybeSingle();
    if (!estimateError && estimate) {
      linked_estimate = estimate;
    }
  }

  return {
    ...(agreement as AgreementRecord),
    versions: (versions ?? []) as AgreementVersion[],
    notes: (notes ?? []) as AgreementNote[],
    linked_estimate,
  };
}

export async function createAgreement(
  supabase: SupabaseClient,
  payload: AgreementPayload,
): Promise<AgreementRecord> {
  const { data, error } = await supabase
    .from("contract_agreements")
    .insert({
      type: payload.type,
      counterparty: payload.counterparty.trim(),
      content: payload.content ?? "",
      linked_estimate_id: payload.linked_estimate_id ?? null,
    })
    .select()
    .single();
  if (error) {
    throw error;
  }

  // Create initial version
  await supabase.from("contract_versions").insert({
    agreement_id: data.id,
    version_number: 1,
    content: payload.content ?? "",
    created_by: null,
  });

  return data as AgreementRecord;
}

export async function updateAgreement(
  supabase: SupabaseClient,
  id: string,
  payload: Partial<AgreementPayload>,
): Promise<AgreementRecord> {
  const updateData: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (payload.type !== undefined) {
    updateData.type = payload.type;
  }
  if (payload.counterparty !== undefined) {
    updateData.counterparty = payload.counterparty.trim();
  }
  if (payload.content !== undefined) {
    updateData.content = payload.content;
  }
  if (payload.linked_estimate_id !== undefined) {
    updateData.linked_estimate_id = payload.linked_estimate_id;
  }
  if (payload.ready_for_signature !== undefined) {
    updateData.ready_for_signature = payload.ready_for_signature;
  }
  if (payload.signature_override_rationale !== undefined) {
    updateData.signature_override_rationale = payload.signature_override_rationale;
  }

  const { data, error } = await supabase
    .from("contract_agreements")
    .update(updateData)
    .eq("id", id)
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data as AgreementRecord;
}

export async function createVersion(
  supabase: SupabaseClient,
  agreementId: string,
  payload: VersionPayload,
): Promise<AgreementVersion> {
  // Get current version number
  const { data: agreement, error: agreementError } = await supabase
    .from("contract_agreements")
    .select("current_version")
    .eq("id", agreementId)
    .single();
  if (agreementError) {
    throw agreementError;
  }

  const newVersionNumber = (agreement.current_version as number) + 1;

  // Create new version
  const { data: version, error: versionError } = await supabase
    .from("contract_versions")
    .insert({
      agreement_id: agreementId,
      version_number: newVersionNumber,
      content: payload.content,
      created_by: payload.created_by ?? null,
      notes: payload.notes ?? null,
    })
    .select()
    .single();
  if (versionError) {
    throw versionError;
  }

  // Update agreement with new version and content
  await supabase
    .from("contract_agreements")
    .update({
      current_version: newVersionNumber,
      content: payload.content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", agreementId);

  return version as AgreementVersion;
}

export async function addNote(
  supabase: SupabaseClient,
  agreementId: string,
  noteText: string,
  versionId: string | null = null,
  createdBy: string | null = null,
): Promise<AgreementNote> {
  const { data, error } = await supabase
    .from("contract_notes")
    .insert({
      agreement_id: agreementId,
      version_id: versionId,
      note_text: noteText.trim(),
      created_by: createdBy,
    })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data as AgreementNote;
}

export async function saveReviewDraft(
  supabase: SupabaseClient,
  agreementId: string,
  storagePath: string,
  content: string | null = null,
  uploadedBy: string | null = null,
): Promise<ReviewDraft> {
  const { data, error } = await supabase
    .from("contract_review_drafts")
    .insert({
      agreement_id: agreementId,
      storage_path: storagePath,
      content,
      uploaded_by: uploadedBy,
    })
    .select()
    .single();
  if (error) {
    throw error;
  }
  return data as ReviewDraft;
}

export async function fetchReviewDrafts(
  supabase: SupabaseClient,
  agreementId: string,
): Promise<ReviewDraft[]> {
  const { data, error } = await supabase
    .from("contract_review_drafts")
    .select("*")
    .eq("agreement_id", agreementId)
    .order("created_at", { ascending: false });
  if (error) {
    throw error;
  }
  return (data ?? []) as ReviewDraft[];
}

