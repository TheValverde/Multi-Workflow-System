import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import {
  fetchAgreementById,
  updateAgreement,
  type AgreementPayload,
} from "@/lib/contracts";

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
    return NextResponse.json(agreement, { status: 200 });
  } catch (error) {
    console.error("[contract.get]", error);
    return NextResponse.json(
      { error: "Unable to load agreement" },
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
  const body = (await request.json()) as Partial<AgreementPayload>;

  try {
    const agreement = await updateAgreement(supabase, id, body);
    return NextResponse.json(agreement, { status: 200 });
  } catch (error) {
    console.error("[contract.patch]", error);
    return NextResponse.json(
      { error: "Unable to update agreement" },
      { status: 500 },
    );
  }
}

