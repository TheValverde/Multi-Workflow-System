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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, owner } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Name is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    if (!owner || typeof owner !== "string" || owner.trim().length === 0) {
      return NextResponse.json(
        { error: "Owner is required and must be a non-empty string" },
        { status: 400 },
      );
    }

    const supabase = getSupabaseServiceRoleClient();
    const { data, error } = await supabase
      .from("estimates")
      .insert({
        name: name.trim(),
        owner: owner.trim(),
        stage: "Artifacts", // Initial stage
      })
      .select("id,name,owner,stage,updated_at")
      .single();

    if (error) {
      console.error("[POST /api/estimates]", error);
      // Check for duplicate key or constraint violations
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "An estimate with this name already exists" },
          { status: 409 },
        );
      }
      throw error;
    }

    return NextResponse.json(
      {
        id: data.id,
        name: data.name,
        owner: data.owner,
        stage: data.stage,
        lastUpdated: data.updated_at ?? null,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[POST /api/estimates]", error);
    return NextResponse.json(
      {
        error: "Unable to create estimate. Check Supabase configuration.",
        details:
          error instanceof Error ? error.message : "Unknown server error",
      },
      { status: 500 },
    );
  }
}


