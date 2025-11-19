import { NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";

type EstimateRecord = {
  id: string;
  name: string;
  owner: string;
  stage: string;
  updated_at: string | null;
};

export async function GET() {
  try {
    const supabase = getSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("estimates")
      .select("id,name,owner,stage,updated_at")
      .order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    const mapped =
      data?.map((estimate: EstimateRecord) => ({
        id: estimate.id,
        name: estimate.name,
        owner: estimate.owner,
        stage: estimate.stage,
        lastUpdated: estimate.updated_at ?? null,
      })) ?? [];

    return NextResponse.json({ data: mapped });
  } catch (error) {
    console.error("[GET /api/estimates]", error);
    return NextResponse.json(
      {
        error: "Unable to load estimates. Check Supabase configuration.",
        details:
          error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 },
    );
  }
}


