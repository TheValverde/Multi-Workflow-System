import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import {
  createVersion,
  type VersionPayload,
} from "@/lib/contracts";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = getSupabaseServiceRoleClient();
  const body = (await request.json()) as VersionPayload;

  if (!body?.content) {
    return NextResponse.json(
      { error: "Content is required." },
      { status: 400 },
    );
  }

  try {
    const version = await createVersion(supabase, id, body);
    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    console.error("[contract.versions.post]", error);
    return NextResponse.json(
      { error: "Unable to create version" },
      { status: 500 },
    );
  }
}

