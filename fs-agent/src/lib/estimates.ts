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
  solutionArchitecture: SolutionArchitectureRecord;
  effortEstimate: EffortEstimateRecord;
  quote: QuoteDetail;
};

export type ArtifactRecord = {
  id: string;
  filename: string;
  storage_path: string;
  size_bytes: number | null;
  uploaded_by: string | null;
  created_at: string;
  public_url: string;
  extract?: ArtifactExtractRecord | null;
};

export type ArtifactExtractRecord = {
  id: string;
  artifact_id: string;
  content_text: string | null;
  content_html: string | null;
  summary: string | null;
  extraction_status: "pending" | "processing" | "ready" | "failed";
  error_message: string | null;
  extracted_at: string | null;
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

export type SolutionArchitectureRecord = {
  id: string;
  estimate_id: string;
  content: string | null;
  approved: boolean;
  approved_by: string | null;
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

export type QuoteRecord = {
  id: string;
  estimate_id: string;
  currency: string;
  payment_terms: string | null;
  delivery_timeline: string | null;
  delivered: boolean;
  delivered_at: string | null;
  delivered_by: string | null;
  updated_at: string;
};

export type QuoteRateRecord = {
  id: string;
  estimate_id: string;
  role: string;
  rate: number;
  updated_at: string;
};

export type QuoteOverrideRecord = {
  id: string;
  estimate_id: string;
  wbs_row_id: string;
  rate: number;
  updated_at: string;
};

export type QuoteDetail = {
  record: QuoteRecord;
  rates: QuoteRateRecord[];
  overrides: QuoteOverrideRecord[];
};

export type QuoteRateInput = {
  role: string;
  rate: number;
};

export type QuoteOverrideInput = {
  wbsRowId: string;
  rate: number;
};

export type QuoteTotalsLine = {
  rowId: string;
  taskCode: string | null;
  description: string;
  role: string;
  hours: number;
  rate: number;
  cost: number;
};

export type QuoteTotals = {
  currency: string;
  totalHours: number;
  totalCost: number;
  roleSummary: Record<string, number>;
  paymentTerms: string | null;
  deliveryTimeline: string | null;
  lines: QuoteTotalsLine[];
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
    solutionArchitecture,
    wbsRows,
    wbsVersions,
    quoteRecord,
    quoteRates,
    quoteOverrides,
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
    ensureSolutionArchitectureRow(supabase, estimateId),
    getWbsRows(supabase, estimateId),
    getWbsVersions(supabase, estimateId),
    ensureQuoteRecord(supabase, estimateId),
    getQuoteRates(supabase, estimateId),
    getQuoteOverrides(supabase, estimateId),
  ]);

  // Fetch extracts for all artifacts
  const artifactIds = artifacts?.map((a) => a.id) ?? [];
  const { data: extracts } = artifactIds.length > 0
    ? await supabase
        .from("artifact_extracts")
        .select("*")
        .in("artifact_id", artifactIds)
    : { data: null };

  const extractMap = new Map(
    extracts?.map((extract) => [extract.artifact_id, extract]) ?? [],
  );

  const mappedArtifacts: ArtifactRecord[] =
    artifacts?.map((artifact) => ({
      ...artifact,
      public_url: getArtifactPublicUrl(supabase, artifact.storage_path),
      extract: extractMap.get(artifact.id) ?? null,
    })) ?? [];

  return {
    estimate,
    artifacts: mappedArtifacts,
    timeline: timeline ?? [],
    businessCase,
    requirements,
    solutionArchitecture,
    effortEstimate: buildEffortEstimate(wbsRows, wbsVersions),
    quote: {
      record: quoteRecord,
      rates: quoteRates,
      overrides: quoteOverrides,
    },
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

async function ensureSolutionArchitectureRow(
  supabase: SupabaseClient,
  estimateId: string,
): Promise<SolutionArchitectureRecord> {
  const { data, error } = await supabase
    .from("estimate_solution_architecture")
    .select("id,estimate_id,content,approved,approved_by,updated_at")
    .eq("estimate_id", estimateId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (data) {
    return data as SolutionArchitectureRecord;
  }
  const { data: inserted, error: insertError } = await supabase
    .from("estimate_solution_architecture")
    .insert({ estimate_id: estimateId })
    .select("id,estimate_id,content,approved,approved_by,updated_at")
    .single();
  if (insertError) {
    throw insertError;
  }
  return inserted as SolutionArchitectureRecord;
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

export async function upsertSolutionArchitecture(
  supabase: SupabaseClient,
  estimateId: string,
  update: Partial<Pick<SolutionArchitectureRecord, "content" | "approved" | "approved_by">>,
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
    .from("estimate_solution_architecture")
    .update(payload)
    .eq("estimate_id", estimateId)
    .select("*")
    .single();
  if (error) {
    throw error;
  }
  return data as SolutionArchitectureRecord;
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

async function ensureQuoteRecord(
  supabase: SupabaseClient,
  estimateId: string,
): Promise<QuoteRecord> {
  const { data, error } = await supabase
    .from("estimate_quote")
    .select(
      "id,estimate_id,currency,payment_terms,delivery_timeline,delivered,delivered_at,delivered_by,updated_at",
    )
    .eq("estimate_id", estimateId)
    .maybeSingle();
  if (error) {
    throw error;
  }
  if (data) {
    return data as QuoteRecord;
  }
  const { data: inserted, error: insertError } = await supabase
    .from("estimate_quote")
    .insert({ estimate_id: estimateId })
    .select(
      "id,estimate_id,currency,payment_terms,delivery_timeline,delivered,delivered_at,delivered_by,updated_at",
    )
    .single();
  if (insertError) {
    throw insertError;
  }
  return inserted as QuoteRecord;
}

async function getQuoteRates(
  supabase: SupabaseClient,
  estimateId: string,
): Promise<QuoteRateRecord[]> {
  const { data, error } = await supabase
    .from("estimate_quote_rates")
    .select("id,estimate_id,role,rate,updated_at")
    .eq("estimate_id", estimateId)
    .order("role", { ascending: true });
  if (error) {
    throw error;
  }
  return (
    data?.map((rate) => ({
      ...rate,
      rate: typeof rate.rate === "number" ? rate.rate : Number(rate.rate) || 0,
    })) ?? []
  );
}

async function getQuoteOverrides(
  supabase: SupabaseClient,
  estimateId: string,
): Promise<QuoteOverrideRecord[]> {
  const { data, error } = await supabase
    .from("estimate_quote_overrides")
    .select("id,estimate_id,wbs_row_id,rate,updated_at")
    .eq("estimate_id", estimateId);
  if (error) {
    throw error;
  }
  return (
    data?.map((row) => ({
      ...row,
      rate: typeof row.rate === "number" ? row.rate : Number(row.rate) || 0,
    })) ?? []
  );
}

export async function updateQuoteRecord(
  supabase: SupabaseClient,
  estimateId: string,
  payload: Partial<
    Pick<
      QuoteRecord,
      "currency" | "payment_terms" | "delivery_timeline" | "delivered"
    >
  >,
) {
  const updatePayload = {
    ...payload,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase
    .from("estimate_quote")
    .update(updatePayload)
    .eq("estimate_id", estimateId);
  if (error) {
    throw error;
  }
}

export async function replaceQuoteRates(
  supabase: SupabaseClient,
  estimateId: string,
  rates: QuoteRateInput[],
) {
  const filtered = rates
    .map((rate) => ({
      role: rate.role.trim(),
      rate: Number(rate.rate) || 0,
    }))
    .filter((rate) => rate.role.length > 0 && rate.rate > 0);
  const { error: deleteError } = await supabase
    .from("estimate_quote_rates")
    .delete()
    .eq("estimate_id", estimateId);
  if (deleteError) throw deleteError;
  if (!filtered.length) return;
  const { error } = await supabase.from("estimate_quote_rates").insert(
    filtered.map((rate) => ({
      estimate_id: estimateId,
      role: rate.role,
      rate: rate.rate,
      updated_at: new Date().toISOString(),
    })),
    { returning: "minimal" },
  );
  if (error) {
    throw error;
  }
}

export async function replaceQuoteOverrides(
  supabase: SupabaseClient,
  estimateId: string,
  overrides: QuoteOverrideInput[],
) {
  const filtered = overrides
    .map((override) => ({
      wbs_row_id: override.wbsRowId,
      rate: Number(override.rate) || 0,
    }))
    .filter((override) => override.wbs_row_id && override.rate > 0);
  const { error: deleteError } = await supabase
    .from("estimate_quote_overrides")
    .delete()
    .eq("estimate_id", estimateId);
  if (deleteError) throw deleteError;
  if (!filtered.length) return;
  const { error } = await supabase.from("estimate_quote_overrides").insert(
    filtered.map((override) => ({
      estimate_id: estimateId,
      wbs_row_id: override.wbs_row_id,
      rate: override.rate,
      updated_at: new Date().toISOString(),
    })),
    { returning: "minimal" },
  );
  if (error) {
    throw error;
  }
}

export async function markQuoteDelivered(
  supabase: SupabaseClient,
  estimateId: string,
  actor: string,
  delivered: boolean,
) {
  const payload = delivered
    ? {
        delivered: true,
        delivered_at: new Date().toISOString(),
        delivered_by: actor,
      }
    : {
        delivered: false,
        delivered_at: null,
        delivered_by: null,
      };
  const { error } = await supabase
    .from("estimate_quote")
    .update({
      ...payload,
      updated_at: new Date().toISOString(),
    })
    .eq("estimate_id", estimateId);
  if (error) {
    throw error;
  }
}

const DEFAULT_ROLE_RATE = 150;

export function calculateQuoteTotals(
  effortEstimate: EffortEstimateRecord,
  quote: QuoteDetail,
): QuoteTotals {
  const roleRates = new Map(
    quote.rates.map((rate) => [rate.role.toLowerCase(), Number(rate.rate)]),
  );
  const overrideRates = new Map(
    quote.overrides.map((override) => [override.wbs_row_id, Number(override.rate)]),
  );
  const lines: QuoteTotalsLine[] = effortEstimate.rows.map((row) => {
    const overrideRate = overrideRates.get(row.id);
    const roleRate =
      roleRates.get((row.role ?? "").toLowerCase()) ?? DEFAULT_ROLE_RATE;
    const rate = overrideRate ?? roleRate;
    const cost = roundCurrency(rate * (row.hours ?? 0));
    return {
      rowId: row.id,
      taskCode: row.task_code,
      description: row.description,
      role: row.role,
      hours: row.hours ?? 0,
      rate,
      cost,
    };
  });
  const totalCost = roundCurrency(lines.reduce((sum, line) => sum + line.cost, 0));
  const totalHours = lines.reduce((sum, line) => sum + (line.hours ?? 0), 0);
  const roleSummary = lines.reduce((acc, line) => {
    const key = line.role || "Unassigned";
    acc[key] = roundCurrency((acc[key] ?? 0) + line.cost);
    return acc;
  }, {} as Record<string, number>);
  return {
    currency: quote.record.currency,
    totalHours,
    totalCost,
    roleSummary,
    paymentTerms: quote.record.payment_terms,
    deliveryTimeline: quote.record.delivery_timeline,
    lines,
  };
}

export function buildQuoteCsv(
  estimate: EstimateDetail,
  totals: QuoteTotals,
): string {
  const header = [
    "Task Code",
    "Description",
    "Role",
    "Hours",
    "Rate",
    "Cost",
    "Assumptions",
  ];
  const rows = totals.lines.map((line) => {
    const sourceRow = estimate.effortEstimate.rows.find(
      (row) => row.id === line.rowId,
    );
    return [
      line.taskCode ?? "",
      sanitizeCsv(line.description),
      sanitizeCsv(line.role ?? ""),
      line.hours.toFixed(2),
      line.rate.toFixed(2),
      line.cost.toFixed(2),
      sanitizeCsv(sourceRow?.assumptions ?? ""),
    ];
  });
  rows.push([]);
  rows.push(["Total Hours", totals.totalHours.toFixed(2)]);
  rows.push(["Total Cost", `${totals.currency} ${totals.totalCost.toFixed(2)}`]);
  rows.push(["Payment Terms", sanitizeCsv(totals.paymentTerms ?? "")]);
  rows.push(["Delivery Timeline", sanitizeCsv(totals.deliveryTimeline ?? "")]);
  return [header, ...rows].map((line) => line.join(",")).join("\n");
}

function sanitizeCsv(value: string) {
  if (!value) return "";
  const replaceQuotes = value.replace(/"/g, '""');
  if (replaceQuotes.includes(",") || replaceQuotes.includes("\n")) {
    return `"${replaceQuotes}"`;
  }
  return replaceQuotes;
}

function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}

