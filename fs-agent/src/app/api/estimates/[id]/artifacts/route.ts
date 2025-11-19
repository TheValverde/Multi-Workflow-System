import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import { ARTIFACT_BUCKET } from "@/lib/storage";
import { fetchEstimateDetail } from "@/lib/estimates";

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

    const { error: insertError } = await supabase
      .from("estimate_artifacts")
      .insert({
        estimate_id: estimateId,
        filename: file.name,
        storage_path: filePath,
        size_bytes: file.size,
        uploaded_by: uploadedBy,
      });

    if (insertError) {
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 },
      );
    }
  }

  const detail = await fetchEstimateDetail(supabase, estimateId);
  return NextResponse.json(detail, { status: 201 });
}

