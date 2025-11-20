import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import { POLICY_EXEMPLAR_BUCKET } from "@/lib/storage";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = getSupabaseServiceRoleClient();

  try {
    // Fetch exemplar metadata
    const { data: exemplar, error: fetchError } = await supabase
      .from("contract_exemplars")
      .select("storage_path, type")
      .eq("id", id)
      .single();

    if (fetchError || !exemplar) {
      return NextResponse.json(
        { error: "Exemplar not found" },
        { status: 404 },
      );
    }

    // Download content from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(POLICY_EXEMPLAR_BUCKET)
      .download(exemplar.storage_path);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: "Failed to download exemplar content" },
        { status: 500 },
      );
    }

    // Read file content
    const text = await fileData.text();

    // Return as HTML (if markdown, convert; otherwise return as-is)
    // For now, we'll return markdown and let the frontend handle conversion
    // In production, you might want to use a markdown-to-HTML converter here
    return NextResponse.json({
      id,
      type: exemplar.type,
      content: text,
      content_html: text, // For now, same as content; can be enhanced with markdown parser
    });
  } catch (error) {
    console.error("[exemplars.content.get]", error);
    return NextResponse.json(
      { error: "Unable to fetch exemplar content" },
      { status: 500 },
    );
  }
}


