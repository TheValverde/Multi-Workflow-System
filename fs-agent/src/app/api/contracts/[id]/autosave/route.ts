import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = getSupabaseServiceRoleClient();
  const body = await request.json();

  if (!body?.content_html) {
    return NextResponse.json(
      { error: "content_html is required" },
      { status: 400 },
    );
  }

  try {
    // Fetch current agreement to get auto_save_version for optimistic locking
    const { data: current, error: fetchError } = await supabase
      .from("contract_agreements")
      .select("auto_save_version")
      .eq("id", id)
      .single();

    if (fetchError) {
      throw fetchError;
    }

    const currentVersion = current?.auto_save_version || 0;
    const newVersion = currentVersion + 1;

    // Update with optimistic locking
    const { data, error } = await supabase
      .from("contract_agreements")
      .update({
        content: body.content_html,
        content_html: body.content_html,
        content_text: body.content_text || "",
        last_auto_saved_at: new Date().toISOString(),
        auto_save_version: newVersion,
        updated_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("auto_save_version", currentVersion) // Optimistic lock check
      .select()
      .single();

    if (error) {
      // Check if it's a version conflict
      if (error.code === "PGRST116" || error.message?.includes("0 rows")) {
        return NextResponse.json(
          {
            error: "Version conflict. Please refresh and try again.",
            conflict: true,
          },
          { status: 409 },
        );
      }
      throw error;
    }

    return NextResponse.json(
      {
        ...data,
        last_auto_saved_at: data.last_auto_saved_at || new Date().toISOString(),
        auto_save_version: newVersion,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[contract.autosave]", error);
    return NextResponse.json(
      {
        error: "Unable to auto-save agreement",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

