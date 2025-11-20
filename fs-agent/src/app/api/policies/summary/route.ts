import { NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import { fetchPolicySummary } from "@/lib/policies";

export async function GET() {
  const supabase = getSupabaseServiceRoleClient();
  try {
    const summary = await fetchPolicySummary(supabase);
    return NextResponse.json(summary, { status: 200 });
  } catch (error) {
    console.error("[policies.summary]", error);
    return NextResponse.json(
      { error: "Unable to load summary" },
      { status: 500 },
    );
  }
}

