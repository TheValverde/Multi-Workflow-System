import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import {
  fetchEstimateDetail,
  upsertRequirements,
} from "@/lib/estimates";
import { logTimelineEntry } from "@/lib/timeline";

type PatchBody = {
  content?: string;
  validate?: boolean;
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
  return NextResponse.json(detail.requirements, { status: 200 });
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
    validated: boolean;
    validated_by: string;
  }> = {};

  if (body.content !== undefined) {
    updatePayload.content = body.content;
  }
  if (body.validate) {
    updatePayload.validated = true;
    updatePayload.validated_by = actor;
  }

  await upsertRequirements(supabase, estimateId, updatePayload);

  if (body.validate) {
    await logTimelineEntry(
      supabase,
      estimateId,
      "Requirements",
      "Requirements Validated",
      actor,
      body.notes,
    );
  } else if (body.content !== undefined) {
    await logTimelineEntry(
      supabase,
      estimateId,
      "Requirements",
      "Requirements Updated",
      actor,
    );
  }

  const detail = await fetchEstimateDetail(supabase, estimateId);
  return NextResponse.json(detail, { status: 200 });
}

