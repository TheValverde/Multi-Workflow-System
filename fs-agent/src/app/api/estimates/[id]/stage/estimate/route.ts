import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import { fetchEstimateDetail } from "@/lib/estimates";
import { buildStageEstimatePayload } from "@/lib/stage-estimate";

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
  const payload = buildStageEstimatePayload(detail);
  return NextResponse.json(payload, { status: 200 });
}

