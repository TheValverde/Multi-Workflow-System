import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import {
  buildQuoteCsv,
  calculateQuoteTotals,
  fetchEstimateDetail,
} from "@/lib/estimates";

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
  const csv = buildQuoteCsv(detail, totals);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="estimate-${detail.estimate.id}-quote.csv"`,
    },
  });
}

