import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import { addNote } from "@/lib/contracts";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = getSupabaseServiceRoleClient();
  const body = (await request.json()) as {
    note_text: string;
    version_id?: string | null;
    created_by?: string | null;
  };

  if (!body?.note_text) {
    return NextResponse.json(
      { error: "Note text is required." },
      { status: 400 },
    );
  }

  try {
    const note = await addNote(
      supabase,
      id,
      body.note_text,
      body.version_id ?? null,
      body.created_by ?? null,
    );
    return NextResponse.json(note, { status: 201 });
  } catch (error) {
    console.error("[contract.notes.post]", error);
    return NextResponse.json(
      { error: "Unable to add note" },
      { status: 500 },
    );
  }
}

