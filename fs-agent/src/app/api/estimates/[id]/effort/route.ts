import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import {
  createWbsVersion,
  fetchEstimateDetail,
  replaceWbsRows,
  type WbsRowInput,
} from "@/lib/estimates";
import { logTimelineEntry } from "@/lib/timeline";

type PatchBody = {
  rows?: WbsRowInput[];
  approve?: boolean;
  actor?: string;
  notes?: string;
};

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = getSupabaseServiceRoleClient();
  const detail = await fetchEstimateDetail(supabase, id);
  if (!detail) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }
  return NextResponse.json(detail.effortEstimate, { status: 200 });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: estimateId } = await context.params;
  const supabase = getSupabaseServiceRoleClient();
  const body = (await request.json()) as PatchBody;
  const actor = body.actor ?? "Demo User";

  try {
    if (Array.isArray(body.rows)) {
      const sanitizedRows = sanitizeRows(body.rows);
      if (!sanitizedRows.length) {
        return NextResponse.json(
          { error: "At least one WBS row is required." },
          { status: 400 },
        );
      }
      await replaceWbsRows(supabase, estimateId, sanitizedRows);
    }

    if (body.approve) {
      await createWbsVersion(supabase, estimateId, actor, body.notes);
      await logTimelineEntry(
        supabase,
        estimateId,
        "Effort Estimate",
        "WBS Approved",
        actor,
        body.notes,
      );
    }

    const detail = await fetchEstimateDetail(supabase, estimateId);
    return NextResponse.json(detail, { status: 200 });
  } catch (error) {
    console.error("[effort-route]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected error" },
      { status: 500 },
    );
  }
}

function sanitizeRows(rows: WbsRowInput[]): WbsRowInput[] {
  return rows
    .map((row) => ({
      ...row,
      description: row.description?.trim() ?? "",
      role: row.role?.trim() ?? "",
      hours: Number(row.hours) || 0,
      taskCode: row.taskCode?.trim() || null,
      assumptions: row.assumptions?.trim() || null,
    }))
    .filter((row) => row.description.length > 0 && row.role.length > 0);
}

