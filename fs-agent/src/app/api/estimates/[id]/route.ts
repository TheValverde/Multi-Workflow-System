import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import {
  countArtifacts,
  fetchEstimateDetail,
  type EstimateDetail,
} from "@/lib/estimates";
import {
  STAGE_ORDER,
  getNextStage,
  isFinalStage,
  type StageKey,
} from "@/lib/stages";

async function buildDetailResponse(
  estimateId: string,
): Promise<EstimateDetail | null> {
  const supabase = getSupabaseServiceRoleClient();
  return fetchEstimateDetail(supabase, estimateId);
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const detail = await buildDetailResponse(id);
  if (!detail) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }
  return NextResponse.json(detail, { status: 200 });
}

type PatchBody = {
  action: "approve" | "advance";
  notes?: string;
  actor?: string;
};

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: estimateId } = await context.params;
  const supabase = getSupabaseServiceRoleClient();
  const body = (await request.json()) as PatchBody;
  const actor = body.actor || "Demo User";

  const detail = await fetchEstimateDetail(supabase, estimateId);
  if (!detail) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  if (!body.action) {
    return NextResponse.json(
      { error: "Action is required" },
      { status: 400 },
    );
  }

  if (body.action === "advance" && isFinalStage(detail.estimate.stage)) {
    return NextResponse.json(
      { error: "This project is already in the final stage." },
      { status: 400 },
    );
  }

  if (
    body.action === "advance" &&
    detail.estimate.stage === "Artifacts" &&
    (await countArtifacts(supabase, estimateId)) < 2
  ) {
    return NextResponse.json(
      {
        error: "Upload at least two artifacts before advancing.",
      },
      { status: 400 },
    );
  }

  if (
    body.action === "advance" &&
    detail.estimate.stage === "Business Case" &&
    !detail.businessCase.approved
  ) {
    return NextResponse.json(
      {
        error: "Approve the Business Case before advancing.",
      },
      { status: 400 },
    );
  }

  if (
    body.action === "advance" &&
    detail.estimate.stage === "Requirements" &&
    !detail.requirements.validated
  ) {
    return NextResponse.json(
      {
        error: "Validate the Requirements before advancing.",
      },
      { status: 400 },
    );
  }

  if (
    body.action === "advance" &&
    detail.estimate.stage === "Effort Estimate" &&
    !detail.effortEstimate.approvedVersion
  ) {
    return NextResponse.json(
      {
        error: "Approve the Effort Estimate before advancing.",
      },
      { status: 400 },
    );
  }

  const nextStage =
    body.action === "advance"
      ? getNextStage(detail.estimate.stage) ?? (detail.estimate.stage as StageKey)
      : (detail.estimate.stage as StageKey);

  if (body.action === "advance" && nextStage !== detail.estimate.stage) {
    const { error: updateError } = await supabase
      .from("estimates")
      .update({
        stage: nextStage,
        updated_at: new Date().toISOString(),
      })
      .eq("id", estimateId);

    if (updateError) {
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 },
      );
    }
  }

  const actionLabel =
    body.action === "advance"
      ? `Advanced to ${nextStage}`
      : `Approved ${detail.estimate.stage}`;

  const { error: timelineError } = await supabase
    .from("estimate_timeline")
    .insert({
      estimate_id: estimateId,
      stage: body.action === "advance" ? nextStage : detail.estimate.stage,
      action: actionLabel,
      actor,
      notes: body.notes ?? null,
    });

  if (timelineError) {
    return NextResponse.json(
      { error: timelineError.message },
      { status: 500 },
    );
  }

  const updatedDetail = await fetchEstimateDetail(supabase, estimateId);
  return NextResponse.json(updatedDetail, { status: 200 });
}

