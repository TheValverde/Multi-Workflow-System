import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import {
  createPolicy,
  fetchPolicies,
  type PolicyPayload,
} from "@/lib/policies";

export async function GET() {
  const supabase = getSupabaseServiceRoleClient();
  try {
    const policies = await fetchPolicies(supabase);
    return NextResponse.json(policies, { status: 200 });
  } catch (error) {
    console.error("[policies.get]", error);
    return NextResponse.json(
      { error: "Unable to load policies" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServiceRoleClient();
  const body = (await request.json()) as PolicyPayload;

  if (!body?.title || !body?.body) {
    return NextResponse.json(
      { error: "Title and body are required." },
      { status: 400 },
    );
  }

  try {
    const policy = await createPolicy(supabase, body);
    return NextResponse.json(policy, { status: 201 });
  } catch (error: any) {
    console.error("[policies.post]", error);
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "A policy with that title already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Unable to create policy" },
      { status: 500 },
    );
  }
}

