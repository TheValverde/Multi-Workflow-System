import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import {
  fetchEstimateDetail,
  upsertBusinessCase,
} from "@/lib/estimates";
import { logTimelineEntry } from "@/lib/timeline";

type PatchBody = {
  content?: string;
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
  return NextResponse.json(detail.businessCase, { status: 200 });
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: estimateId } = await context.params;
  const supabase = getSupabaseServiceRoleClient();
  const body = (await request.json()) as PatchBody;
  const actor = body.actor ?? "Demo User";

  const updatePayload: Partial<{
    content: string;
    approved: boolean;
    approved_by: string;
  }> = {};

  if (body.content !== undefined) {
    updatePayload.content = body.content;
  }
  if (body.approve) {
    updatePayload.approved = true;
    updatePayload.approved_by = actor;
  }

  await upsertBusinessCase(supabase, estimateId, updatePayload);

  if (body.approve) {
    await logTimelineEntry(
      supabase,
      estimateId,
      "Business Case",
      "Business Case Approved",
      actor,
      body.notes,
    );
  } else if (body.content !== undefined) {
    await logTimelineEntry(
      supabase,
      estimateId,
      "Business Case",
      "Business Case Updated",
      actor,
    );
  }

  const detail = await fetchEstimateDetail(supabase, estimateId);
  return NextResponse.json(detail, { status: 200 });
}

