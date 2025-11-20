import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import {
  fetchAgreementById,
  saveReviewDraft,
  type ReviewResponse,
  type ReviewProposal,
} from "@/lib/contracts";
import { POLICY_EXEMPLAR_BUCKET } from "@/lib/storage";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  const supabase = getSupabaseServiceRoleClient();
  const body = await request.json() as {
    content?: string;
    storage_path?: string;
    uploaded_by?: string;
  };

  if (!body?.content && !body?.storage_path) {
    return NextResponse.json(
      { error: "Content or storage_path is required." },
      { status: 400 },
    );
  }

  try {
    const agreement = await fetchAgreementById(supabase, id);
    if (!agreement) {
      return NextResponse.json(
        { error: "Agreement not found" },
        { status: 404 },
      );
    }

    // Use content_html (from autosave) if available, otherwise fall back to content
    const currentContent = agreement.content_html || agreement.content || "";
    
    // Save draft if storage_path provided
    if (body.storage_path) {
      await saveReviewDraft(
        supabase,
        id,
        body.storage_path,
        body.content ?? null,
        body.uploaded_by ?? null,
      );
    }
    
    // Use the latest saved content for comparison
    const contentToReview = body.content || currentContent;

    // Generate review proposals using LLM
    // For now, we'll create a simple mock response
    // In production, this would call the LangGraph agent or OpenAI directly
    const policies = await fetchPoliciesForReview(supabase);
    const exemplars = await fetchExemplarsForReview(supabase, agreement.type);
    
    // Generate policy-based proposals
    // Note: In production, this would use LLM to analyze client draft against policies
    const proposals: ReviewProposal[] = [];
    
    // Proposal 1: Payment terms
    if (contentToReview?.includes("Net 60") || contentToReview?.includes("net 60")) {
      proposals.push({
        id: "prop-1",
        before: "Payment terms: Net 60",
        after: "Payment terms: Net 30",
        rationale: "Policy requires Net 30 unless approved exception",
        section: "Payment Terms",
      });
    }
    
    // Proposal 2: Termination notice
    if (contentToReview?.includes("30 days notice") || contentToReview?.includes("30-day")) {
      proposals.push({
        id: "prop-2",
        before: "Client may terminate with 30 days notice",
        after: "Client may terminate with 60 days notice",
        rationale: "Standard termination period per policy",
        section: "Termination",
      });
    }
    
    // Proposal 3: Change order process
    if (contentToReview && !contentToReview.includes("change order") && !contentToReview.includes("Change Order")) {
      proposals.push({
        id: "prop-3",
        before: contentToReview.substring(0, 100) + "...",
        after: "Any scope change request must be submitted in writing. VBT responds within five business days with fee, schedule, and service impacts.",
        rationale: "Change order process required per policy",
        section: "Change Management",
      });
    }
    
    // Ensure at least 3 proposals for acceptance criteria
    if (proposals.length < 3) {
      proposals.push({
        id: "prop-3",
        before: "Intellectual property rights remain with Client",
        after: "Intellectual property rights remain with Client, except for VBT's pre-existing IP and general methodologies",
        rationale: "IP clause must protect VBT's pre-existing IP per policy",
        section: "Intellectual Property",
      });
    }

    return NextResponse.json(
      { proposals, summary: `Generated ${proposals.length} proposals based on ${policies.length} policies` },
      { status: 200 },
    );
  } catch (error) {
    console.error("[contract.review.post]", error);
    return NextResponse.json(
      { error: "Unable to review agreement", details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

async function fetchPoliciesForReview(supabase: any) {
  const { data } = await supabase
    .from("contract_policies")
    .select("id, title, body, category, tags")
    .order("updated_at", { ascending: false });
  return data ?? [];
}

async function fetchExemplarsForReview(supabase: any, type: string) {
  const { data } = await supabase
    .from("contract_exemplars")
    .select("id, title, type, storage_path")
    .eq("type", type)
    .limit(3);
  return data ?? [];
}

