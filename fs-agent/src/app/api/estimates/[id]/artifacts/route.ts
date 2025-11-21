import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import { ARTIFACT_BUCKET } from "@/lib/storage";
import { fetchEstimateDetail } from "@/lib/estimates";
import { extractTextFromFile } from "@/lib/artifact-extraction";

const EXTENSION_MIME_MAP: Record<string, string> = {
  md: "text/markdown",
  txt: "text/plain",
  json: "application/json",
  csv: "text/csv",
  pdf: "application/pdf",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  doc: "application/msword",
  docx:
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx:
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx:
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

function resolveContentType(file: File): string | undefined {
  if (file.type) {
    return file.type;
  }
  const ext = file.name.split(".").pop()?.toLowerCase();
  if (ext && EXTENSION_MIME_MAP[ext]) {
    return EXTENSION_MIME_MAP[ext];
  }
  return "application/octet-stream";
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: estimateId } = await context.params;
  const supabase = getSupabaseServiceRoleClient();

  const formData = await request.formData();
  const files = formData.getAll("files") as File[];
  const uploadedBy =
    (formData.get("uploadedBy") as string | null) ?? "Demo User";

  if (!files || files.length === 0) {
    return NextResponse.json(
      { error: "No files provided" },
      { status: 400 },
    );
  }

  const artifactIds: string[] = [];

  for (const file of files) {
    const arrayBuffer = await file.arrayBuffer();
    const filePath = `${estimateId}/${Date.now()}-${file.name}`;
    const { error: uploadError } = await supabase.storage
      .from(ARTIFACT_BUCKET)
      .upload(filePath, arrayBuffer, {
        contentType: resolveContentType(file),
        upsert: false,
      });

    if (uploadError) {
      return NextResponse.json(
        { error: uploadError.message },
        { status: 500 },
      );
    }

    const { data: insertedArtifact, error: insertError } = await supabase
      .from("estimate_artifacts")
      .insert({
        estimate_id: estimateId,
        filename: file.name,
        storage_path: filePath,
        size_bytes: file.size,
        uploaded_by: uploadedBy,
      })
      .select("id")
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 },
      );
    }

    if (insertedArtifact) {
      artifactIds.push(insertedArtifact.id);
    }
  }

  // Trigger extraction for MD and DOCX files asynchronously
  // Process in background - don't block the response
  for (let i = 0; i < artifactIds.length; i++) {
    const artifactId = artifactIds[i];
    const file = files[i];
    if (!file) continue;

    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "md" || ext === "docx") {
      // Process extraction in background (don't await)
      (async () => {
        try {
          // Fetch artifact metadata
          const { data: artifact } = await supabase
            .from("estimate_artifacts")
            .select("id,filename,storage_path")
            .eq("id", artifactId)
            .eq("estimate_id", estimateId)
            .single();

          if (!artifact) {
            console.error(`[Artifact Upload] Artifact ${artifactId} not found for extraction`);
            return;
          }

          // Check if extraction already exists and is ready
          const { data: existingExtract } = await supabase
            .from("artifact_extracts")
            .select("id,extraction_status")
            .eq("artifact_id", artifactId)
            .eq("extraction_status", "ready")
            .maybeSingle();

          if (existingExtract) {
            return; // Already extracted
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
            return;
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
            return;
          }

          // Save extraction result
          await supabase.from("artifact_extracts").upsert({
            artifact_id: artifactId,
            content_text: result.contentText,
            content_html: result.contentHtml,
            summary: result.summary,
            extraction_status: "ready",
            extracted_at: new Date().toISOString(),
            error_message: null,
          });
        } catch (err) {
          console.error(`[Artifact Upload] Failed to extract ${file.name}:`, err);
          // Mark as failed
          await supabase.from("artifact_extracts").upsert({
            artifact_id: artifactId,
            extraction_status: "failed",
            error_message: err instanceof Error ? err.message : "Unknown error",
          });
        }
      })();
    }
  }

  const detail = await fetchEstimateDetail(supabase, estimateId);
  return NextResponse.json(detail, { status: 201 });
}

