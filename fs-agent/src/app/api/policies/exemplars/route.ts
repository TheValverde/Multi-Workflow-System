import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import { POLICY_EXEMPLAR_BUCKET } from "@/lib/storage";
import { fetchExemplars, normalizeTags } from "@/lib/policies";

function getContentType(filename: string, fileType: string | undefined) {
  if (fileType) return fileType;
  const ext = filename.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "md":
    case "txt":
      return "text/plain";
    case "pdf":
      return "application/pdf";
    case "doc":
      return "application/msword";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    default:
      return "application/octet-stream";
  }
}

export async function GET() {
  const supabase = getSupabaseServiceRoleClient();
  try {
    const exemplars = await fetchExemplars(supabase);
    return NextResponse.json(exemplars, { status: 200 });
  } catch (error) {
    console.error("[exemplars.get]", error);
    return NextResponse.json(
      { error: "Unable to load exemplars" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseServiceRoleClient();
  const formData = await request.formData();
  const file = formData.get("file");
  const title = (formData.get("title") as string | null)?.trim();
  const type = (formData.get("type") as string | null)?.trim();
  const summary = (formData.get("summary") as string | null)?.trim();
  const tags = normalizeTags(formData.get("tags") ?? undefined);
  const uploadedBy = (formData.get("uploadedBy") as string | null)?.trim();

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "File upload is required." },
      { status: 400 },
    );
  }

  if (!title || !type) {
    return NextResponse.json(
      { error: "Title and type are required." },
      { status: 400 },
    );
  }

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const storagePath = `${type.toLowerCase()}/${Date.now()}-${file.name}`;
    const contentType = getContentType(file.name, file.type);

    const { error: uploadError } = await supabase.storage
      .from(POLICY_EXEMPLAR_BUCKET)
      .upload(storagePath, buffer, {
        contentType,
        upsert: false,
      });
    if (uploadError) {
      throw uploadError;
    }

    const { data, error } = await supabase
      .from("contract_exemplars")
      .insert({
        title,
        type,
        summary,
        storage_path: storagePath,
        tags,
        uploaded_by: uploadedBy ?? "Admin User",
      })
      .select(
        "id,title,type,summary,storage_path,tags,uploaded_by,created_at,updated_at",
      )
      .single();
    if (error) {
      throw error;
    }
    const exemplars = await fetchExemplars(supabase);
    return NextResponse.json(exemplars, { status: 201 });
  } catch (error) {
    console.error("[exemplars.post]", error);
    return NextResponse.json(
      { error: "Unable to upload exemplar" },
      { status: 500 },
    );
  }
}

