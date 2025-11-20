import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import {
  fetchEstimateDetail,
  upsertSolutionArchitecture,
} from "@/lib/estimates";
import { logTimelineEntry } from "@/lib/timeline";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: estimateId } = await context.params;
  const supabase = getSupabaseServiceRoleClient();
  const body = await request.json();
  const { content, approved, approved_by } = body;

  await upsertSolutionArchitecture(supabase, estimateId, {
    content: content ?? undefined,
    approved: approved ?? undefined,
    approved_by: approved_by ?? undefined,
  });

  if (approved) {
    await logTimelineEntry(
      supabase,
      estimateId,
      "Solution/Architecture",
      "Solution & Architecture approved",
      approved_by || "User",
    );
  }

  const updatedDetail = await fetchEstimateDetail(supabase, estimateId);
  return NextResponse.json(updatedDetail, { status: 200 });
}

