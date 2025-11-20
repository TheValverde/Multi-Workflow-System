import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import {
  fetchAgreements,
  createAgreement,
  type AgreementPayload,
} from "@/lib/contracts";

export async function GET() {
  const supabase = getSupabaseServiceRoleClient();
  try {
    const agreements = await fetchAgreements(supabase);
    return NextResponse.json(agreements, { status: 200 });
  } catch (error) {
    console.error("[contracts.get]", error);
    return NextResponse.json(
      { error: "Unable to load agreements" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServiceRoleClient();
  const body = (await request.json()) as AgreementPayload;

  if (!body?.type || !body?.counterparty) {
    return NextResponse.json(
      { error: "Type and counterparty are required." },
      { status: 400 },
    );
  }

  if (!["MSA", "SOW", "NDA", "Addendum"].includes(body.type)) {
    return NextResponse.json(
      { error: "Type must be MSA, SOW, NDA, or Addendum." },
      { status: 400 },
    );
  }

  try {
    const agreement = await createAgreement(supabase, body);
    return NextResponse.json(agreement, { status: 201 });
  } catch (error) {
    console.error("[contracts.post]", error);
    return NextResponse.json(
      { error: "Unable to create agreement" },
      { status: 500 },
    );
  }
}

