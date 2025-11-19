import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import {
  calculateQuoteTotals,
  fetchEstimateDetail,
  markQuoteDelivered,
  replaceQuoteOverrides,
  replaceQuoteRates,
  updateQuoteRecord,
  type QuoteOverrideInput,
  type QuoteRateInput,
} from "@/lib/estimates";
import { logTimelineEntry } from "@/lib/timeline";

type PatchBody = {
  currency?: string;
  paymentTerms?: string;
  deliveryTimeline?: string;
  rates?: QuoteRateInput[];
  overrides?: QuoteOverrideInput[];
  delivered?: boolean;
  actor?: string;
  notes?: string;
  adminOverride?: boolean;
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
  const totals = calculateQuoteTotals(detail.effortEstimate, detail.quote);
  return NextResponse.json(
    {
      quote: detail.quote,
      totals,
    },
    { status: 200 },
  );
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: estimateId } = await context.params;
  const supabase = getSupabaseServiceRoleClient();
  const body = (await request.json()) as PatchBody;
  const actor = body.actor ?? "Demo User";

  const detail = await fetchEstimateDetail(supabase, estimateId);
  if (!detail) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  const quoteRecord = detail.quote.record;
  const editingLocked =
    quoteRecord.delivered && body.adminOverride !== true &&
    (body.paymentTerms !== undefined ||
      body.deliveryTimeline !== undefined ||
      body.currency !== undefined ||
      body.rates !== undefined ||
      body.overrides !== undefined ||
      (body.delivered === false));

  if (editingLocked) {
    return NextResponse.json(
      { error: "Quote already marked delivered. Admin override required." },
      { status: 400 },
    );
  }

  try {
    if (
      body.paymentTerms !== undefined ||
      body.deliveryTimeline !== undefined ||
      body.currency !== undefined
    ) {
      await updateQuoteRecord(supabase, estimateId, {
        payment_terms: body.paymentTerms,
        delivery_timeline: body.deliveryTimeline,
        currency: body.currency,
      });
    }

    if (Array.isArray(body.rates)) {
      await replaceQuoteRates(supabase, estimateId, body.rates);
    }

    if (Array.isArray(body.overrides)) {
      await replaceQuoteOverrides(supabase, estimateId, body.overrides);
    }

    if (body.delivered !== undefined) {
      const previousDelivered = quoteRecord.delivered;
      if (previousDelivered !== body.delivered) {
        await markQuoteDelivered(supabase, estimateId, actor, body.delivered);
        await logTimelineEntry(
          supabase,
          estimateId,
          "Quote",
          body.delivered ? "Quote delivered" : "Quote reopened",
          actor,
          body.notes,
        );
      }
    }

    await supabase
      .from("estimates")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", estimateId);

    const updatedDetail = await fetchEstimateDetail(supabase, estimateId);
    return NextResponse.json(updatedDetail, { status: 200 });
  } catch (error) {
    console.error("[quote-route]", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to update quote" },
      { status: 500 },
    );
  }
}

