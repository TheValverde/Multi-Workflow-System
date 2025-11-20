import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import { ARTIFACT_BUCKET } from "@/lib/storage";
import { extractTextFromFile } from "@/lib/artifact-extraction";

/**
 * Extract text from an artifact (MD or DOCX)
 * POST /api/estimates/[id]/artifacts/extract
 * Body: { artifactId: string }
 */
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: estimateId } = await context.params;
  const supabase = getSupabaseServiceRoleClient();

  try {
    const body = await request.json();
    const { artifactId } = body;

    if (!artifactId) {
      return NextResponse.json(
        { error: "artifactId is required" },
        { status: 400 },
      );
    }

    // Fetch artifact metadata
    const { data: artifact, error: artifactError } = await supabase
      .from("estimate_artifacts")
      .select("id,filename,storage_path")
      .eq("id", artifactId)
      .eq("estimate_id", estimateId)
      .single();

    if (artifactError || !artifact) {
      return NextResponse.json(
        { error: "Artifact not found" },
        { status: 404 },
      );
    }

    // Check if extraction already exists and is ready
    const { data: existingExtract } = await supabase
      .from("artifact_extracts")
      .select("id,extraction_status")
      .eq("artifact_id", artifactId)
      .eq("extraction_status", "ready")
      .maybeSingle();

    if (existingExtract) {
      return NextResponse.json(
        { message: "Extraction already completed", artifactId },
        { status: 200 },
      );
    }

    // Update status to processing
    await supabase.from("artifact_extracts").upsert({
      artifact_id: artifactId,
      extraction_status: "processing",
      error_message: null,
    });

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(ARTIFACT_BUCKET)
      .download(artifact.storage_path);

    if (downloadError || !fileData) {
      await supabase.from("artifact_extracts").upsert({
        artifact_id: artifactId,
        extraction_status: "failed",
        error_message: downloadError?.message || "Failed to download file",
      });
      return NextResponse.json(
        { error: "Failed to download artifact file" },
        { status: 500 },
      );
    }

    // Convert blob to buffer
    const arrayBuffer = await fileData.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Extract text based on file type
    const result = await extractTextFromFile(
      buffer,
      artifact.filename,
    );

    if (result.error) {
      await supabase.from("artifact_extracts").upsert({
        artifact_id: artifactId,
        extraction_status: "failed",
        error_message: result.error,
      });
      return NextResponse.json(
        { error: result.error },
        { status: 500 },
      );
    }

    // Save extraction result
    const { error: upsertError } = await supabase
      .from("artifact_extracts")
      .upsert({
        artifact_id: artifactId,
        content_text: result.contentText,
        content_html: result.contentHtml,
        summary: result.summary,
        extraction_status: "ready",
        extracted_at: new Date().toISOString(),
        error_message: null,
      });

    if (upsertError) {
      return NextResponse.json(
        { error: "Failed to save extraction result" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      {
        message: "Extraction completed",
        artifactId,
        summary: result.summary,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[POST /api/estimates/[id]/artifacts/extract]", error);
    return NextResponse.json(
      {
        error: "Failed to extract artifact",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

