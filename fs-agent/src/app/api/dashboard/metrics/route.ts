import { NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";

export async function GET() {
  try {
    const supabase = getSupabaseServiceRoleClient();

    // Fetch estimates count and last updated
    const { data: estimatesData, error: estimatesError } = await supabase
      .from("estimates")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (estimatesError) {
      throw estimatesError;
    }

    const { count: estimatesCount, error: estimatesCountError } = await supabase
      .from("estimates")
      .select("*", { count: "exact", head: true });

    if (estimatesCountError) {
      throw estimatesCountError;
    }

    // Fetch contracts count and last updated
    const { data: contractsData, error: contractsError } = await supabase
      .from("contract_agreements")
      .select("updated_at")
      .order("updated_at", { ascending: false })
      .limit(1);

    if (contractsError) {
      throw contractsError;
    }

    const { count: contractsCount, error: contractsCountError } = await supabase
      .from("contract_agreements")
      .select("*", { count: "exact", head: true });

    if (contractsCountError) {
      throw contractsCountError;
    }

    return NextResponse.json({
      estimates: {
        count: estimatesCount ?? 0,
        lastUpdated: estimatesData?.[0]?.updated_at ?? null,
      },
      contracts: {
        count: contractsCount ?? 0,
        lastUpdated: contractsData?.[0]?.updated_at ?? null,
      },
    });
  } catch (error) {
    console.error("[GET /api/dashboard/metrics]", error);
    return NextResponse.json(
      {
        error: "Unable to load dashboard metrics",
        details: error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 }
    );
  }
}

