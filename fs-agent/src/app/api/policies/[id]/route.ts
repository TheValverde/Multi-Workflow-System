import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import {
  deletePolicy,
  fetchPolicyById,
  updatePolicy,
  type PolicyPayload,
} from "@/lib/policies";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = getSupabaseServiceRoleClient();
  try {
    const policy = await fetchPolicyById(supabase, id);
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }
    return NextResponse.json(policy, { status: 200 });
  } catch (error) {
    console.error("[policy.get]", error);
    return NextResponse.json(
      { error: "Unable to load policy" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = getSupabaseServiceRoleClient();
  const body = (await request.json()) as PolicyPayload;

  if (body.title !== undefined && !body.title.trim()) {
    return NextResponse.json(
      { error: "Title cannot be empty." },
      { status: 400 },
    );
  }

  try {
    const policy = await updatePolicy(supabase, id, body);
    return NextResponse.json(policy, { status: 200 });
  } catch (error: any) {
    console.error("[policy.patch]", error);
    if (error?.code === "23505") {
      return NextResponse.json(
        { error: "A policy with that title already exists." },
        { status: 409 },
      );
    }
    return NextResponse.json(
      { error: "Unable to update policy" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = getSupabaseServiceRoleClient();
  try {
    await deletePolicy(supabase, id);
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    console.error("[policy.delete]", error);
    return NextResponse.json(
      { error: "Unable to delete policy" },
      { status: 500 },
    );
  }
}

