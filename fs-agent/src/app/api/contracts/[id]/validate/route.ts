import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import {
  fetchAgreementById,
  type ValidationResult,
  type Discrepancy,
} from "@/lib/contracts";
import { fetchEstimateDetail } from "@/lib/estimates";
import { buildStageEstimatePayload } from "@/lib/stage-estimate";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = getSupabaseServiceRoleClient();

  try {
    const agreement = await fetchAgreementById(supabase, id);
    if (!agreement) {
      return NextResponse.json(
        { error: "Agreement not found" },
        { status: 404 },
      );
    }

    if (agreement.type !== "SOW") {
      return NextResponse.json(
        { error: "Validation is only available for SOW agreements" },
        { status: 400 },
      );
    }

    if (!agreement.linked_estimate_id) {
      return NextResponse.json(
        {
          valid: false,
          discrepancies: [],
          summary: "No estimate linked to this SOW",
          validated_at: new Date().toISOString(),
        } as ValidationResult,
        { status: 200 },
      );
    }

    const estimateDetail = await fetchEstimateDetail(
      supabase,
      agreement.linked_estimate_id,
    );
    if (!estimateDetail) {
      return NextResponse.json(
        { error: "Linked estimate not found" },
        { status: 404 },
      );
    }

    const estimateData = buildStageEstimatePayload(estimateDetail);
    const discrepancies = validateSowAgainstEstimate(
      agreement.content,
      estimateData,
    );

    const valid = discrepancies.filter((d) => d.severity === "error").length === 0;
    const summary = valid
      ? "SOW aligns with estimate. No critical discrepancies found."
      : `Found ${discrepancies.length} discrepancy(ies) requiring attention.`;

    const result: ValidationResult = {
      valid,
      discrepancies,
      summary,
      validated_at: new Date().toISOString(),
    };

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error("[contract.validate.get]", error);
    return NextResponse.json(
      {
        error: "Unable to validate agreement",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

function validateSowAgainstEstimate(
  sowContent: string,
  estimate: ReturnType<typeof buildStageEstimatePayload>,
): Discrepancy[] {
  const discrepancies: Discrepancy[] = [];
  const contentLower = sowContent.toLowerCase();

  // Payment terms validation
  if (estimate.paymentTerms) {
    const estimateTerms = estimate.paymentTerms.toLowerCase();
    const net30Match = contentLower.match(/net\s*30/i);
    const net45Match = contentLower.match(/net\s*45/i);
    const net60Match = contentLower.match(/net\s*60/i);
    const net90Match = contentLower.match(/net\s*90/i);

    let sowTerms: string | null = null;
    if (net30Match) sowTerms = "Net 30";
    else if (net45Match) sowTerms = "Net 45";
    else if (net60Match) sowTerms = "Net 60";
    else if (net90Match) sowTerms = "Net 90";

    if (sowTerms && sowTerms.toLowerCase() !== estimateTerms) {
      discrepancies.push({
        id: "payment-terms-1",
        category: "payment_terms",
        severity: "error",
        message: `Payment terms mismatch: SOW specifies "${sowTerms}" but estimate quote requires "${estimate.paymentTerms}"`,
        reference: "Payment Terms section",
        expected: estimate.paymentTerms,
        actual: sowTerms,
      });
    } else if (!sowTerms && estimateTerms.includes("net")) {
      discrepancies.push({
        id: "payment-terms-2",
        category: "payment_terms",
        severity: "warning",
        message: `SOW does not specify payment terms, but estimate quote requires "${estimate.paymentTerms}"`,
        reference: "Payment Terms section",
        expected: estimate.paymentTerms,
        actual: "Not specified",
      });
    }
  }

  // Hours validation - check if SOW mentions hours that differ significantly
  const hourMentions = contentLower.match(/(\d+)\s*(?:hours?|hrs?)/gi);
  if (hourMentions && estimate.totalHours > 0) {
    const mentionedHours = hourMentions
      .map((m) => parseInt(m.match(/\d+/)![0]))
      .reduce((sum, h) => sum + h, 0);
    const delta = Math.abs(mentionedHours - estimate.totalHours);
    const percentDelta = (delta / estimate.totalHours) * 100;

    if (percentDelta > 10) {
      discrepancies.push({
        id: "hours-1",
        category: "hours",
        severity: percentDelta > 20 ? "error" : "warning",
        message: `Hour discrepancy: SOW mentions approximately ${mentionedHours} hours, but WBS totals ${estimate.totalHours} hours (${percentDelta.toFixed(1)}% difference)`,
        reference: "Scope/Effort section",
        expected: `${estimate.totalHours} hours`,
        actual: `~${mentionedHours} hours`,
      });
    }
  }

  // Scope validation - check if WBS tasks are referenced in SOW
  const missingTasks: string[] = [];
  for (const row of estimate.rows) {
    if (row.description) {
      const taskKeywords = row.description
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4);
      const found = taskKeywords.some((keyword) =>
        contentLower.includes(keyword),
      );
      if (!found && row.hours > 8) {
        // Only flag significant tasks (>8 hours)
        missingTasks.push(row.description);
      }
    }
  }

  if (missingTasks.length > 0 && missingTasks.length <= 3) {
    discrepancies.push({
      id: "scope-1",
      category: "scope",
      severity: "warning",
      message: `SOW may be missing references to WBS tasks: ${missingTasks.slice(0, 2).join(", ")}${missingTasks.length > 2 ? "..." : ""}`,
      reference: "Scope/Deliverables section",
      expected: `Include all approved WBS tasks`,
      actual: `${missingTasks.length} task(s) not clearly referenced`,
    });
  }

  // Delivery timeline validation
  if (estimate.deliveryTimeline) {
    const timelineLower = estimate.deliveryTimeline.toLowerCase();
    const timelineMentioned = contentLower.includes("deliver") ||
      contentLower.includes("timeline") ||
      contentLower.includes("schedule");
    
    if (!timelineMentioned) {
      discrepancies.push({
        id: "timeline-1",
        category: "timeline",
        severity: "info",
        message: `SOW does not explicitly reference delivery timeline, but estimate specifies: "${estimate.deliveryTimeline}"`,
        reference: "Delivery/Timeline section",
        expected: estimate.deliveryTimeline,
        actual: "Not specified",
      });
    }
  }

  return discrepancies;
}

