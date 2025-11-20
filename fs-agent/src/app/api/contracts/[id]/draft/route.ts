import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import { saveReviewDraft } from "@/lib/contracts";
import { CONTRACT_DRAFTS_BUCKET } from "@/lib/storage";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = getSupabaseServiceRoleClient();

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const content = formData.get("content") as string | null;
    const uploadedBy = formData.get("uploaded_by") as string | null;

    if (!file && !content) {
      return NextResponse.json(
        { error: "File or content is required." },
        { status: 400 },
      );
    }

    let storagePath: string;
    let draftContent: string | null = content;

    if (file) {
      const fileExt = file.name.split(".").pop();
      const fileName = `${id}/${Date.now()}.${fileExt}`;
      storagePath = fileName;

      const { error: uploadError } = await supabase.storage
        .from(CONTRACT_DRAFTS_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type || "text/plain",
          upsert: false,
        });

      if (uploadError) {
        throw uploadError;
      }

      // Read file content if not provided
      if (!draftContent) {
        const { data: fileData, error: downloadError } = await supabase.storage
          .from(CONTRACT_DRAFTS_BUCKET)
          .download(storagePath);
        if (!downloadError && fileData) {
          draftContent = await fileData.text();
        }
      }
    } else {
      // Content-only draft
      storagePath = `${id}/pasted-${Date.now()}.txt`;
      const { error: uploadError } = await supabase.storage
        .from(CONTRACT_DRAFTS_BUCKET)
        .upload(storagePath, new Blob([content || ""], { type: "text/plain" }), {
          contentType: "text/plain",
          upsert: false,
        });
      if (uploadError) {
        throw uploadError;
      }
    }

    const draft = await saveReviewDraft(
      supabase,
      id,
      storagePath,
      draftContent,
      uploadedBy ?? null,
    );

    return NextResponse.json(draft, { status: 201 });
  } catch (error) {
    console.error("[contract.draft.post]", error);
    return NextResponse.json(
      { error: "Unable to save draft", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

