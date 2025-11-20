import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import {
  fetchEstimateDetail,
  upsertBusinessCase,
} from "@/lib/estimates";
import { logTimelineEntry } from "@/lib/timeline";

function composeBusinessCase(detail: Awaited<ReturnType<typeof fetchEstimateDetail>>) {
  if (!detail) {
    return "<p>No project context available.</p>";
  }

  // Extract key information from artifacts
  const artifactsWithContent = detail.artifacts.filter(
    (a) => a.extract?.extraction_status === "ready" && a.extract.content_text,
  );
  const artifactsWithoutContent = detail.artifacts.filter(
    (a) => !a.extract || a.extract.extraction_status !== "ready",
  );

  // Extract objectives, goals, and key requirements from artifacts
  let objectives: string[] = [];
  let successMetrics: string[] = [];
  let keyRequirements: string[] = [];
  let scopeItems: string[] = [];

  artifactsWithContent.forEach((artifact) => {
    const content = artifact.extract!.content_text || "";
    const cleaned = cleanArtifactContent(content);
    
    // Extract objectives (look for "Objective", "Goal", "Purpose" sections)
    const objectiveMatch = cleaned.match(/(?:objective|goal|purpose)[:\-]?\s*(.+?)(?:\n\n|\n##|$)/is);
    if (objectiveMatch) {
      const objective = objectiveMatch[1].trim().split(/[.!?]/)[0];
      if (objective.length > 20 && objective.length < 200) {
        objectives.push(objective);
      }
    }

    // Extract success metrics
    const metricsMatch = cleaned.match(/(?:success metrics?|metrics?)[:\-]?\s*([\s\S]+?)(?:\n\n|\n##|$)/i);
    if (metricsMatch) {
      const metricsText = metricsMatch[1];
      const metrics = metricsText
        .split(/[-•*]\s+/)
        .map(m => m.trim())
        .filter(m => m.length > 10 && m.length < 150)
        .slice(0, 5);
      successMetrics.push(...metrics);
    }

    // Extract key requirements (from "Requirements" or "Functional Requirements" sections)
    const reqMatch = cleaned.match(/(?:functional requirements?|requirements?)[:\-]?\s*([\s\S]+?)(?:\n##|$)/i);
    if (reqMatch) {
      const reqText = reqMatch[1];
      const reqs = reqText
        .split(/\n(?=\d+\.|\*\*)/)
        .map(r => r.trim())
        .filter(r => r.length > 15 && r.length < 200)
        .slice(0, 5);
      keyRequirements.push(...reqs);
    }

    // Extract scope items (from workflow descriptions, capabilities)
    const scopeMatch = cleaned.match(/(?:workflow|capabilities?|scope)[:\-]?\s*([\s\S]+?)(?:\n##|$)/i);
    if (scopeMatch) {
      const scopeText = scopeMatch[1];
      const scopes = scopeText
        .split(/\n(?=\d+\.|\*\*)/)
        .map(s => s.trim())
        .filter(s => s.length > 20 && s.length < 200)
        .slice(0, 4);
      scopeItems.push(...scopes);
    }
  });

  // Build artifact summary
  let artifactItems = "";
  if (artifactsWithContent.length > 0) {
    artifactItems = artifactsWithContent
      .slice(0, 5)
      .map((artifact) => {
        const extract = artifact.extract!;
        // Use summary if available and meaningful, otherwise extract key points
        let preview = extract.summary || "";
        if (!preview || preview.length < 50) {
          const content = extract.content_text || "";
          const cleaned = cleanArtifactContent(content);
          // Extract first meaningful paragraph
          const paragraphs = cleaned.split(/\n\n+/).filter(p => p.trim().length > 50);
          preview = paragraphs[0]?.substring(0, 300).trim() || cleaned.substring(0, 200).trim();
        }
        return `<li><strong>${escapeHtml(artifact.filename)}</strong> · ${formatRelativeDate(artifact.created_at)}<br>${escapeHtml(preview)}${preview.length > 200 ? "..." : ""}</li>`;
      })
      .join("");
  }

  if (artifactsWithoutContent.length > 0) {
    const fallbackItems = artifactsWithoutContent
      .slice(0, 5)
      .map(
        (artifact) =>
          `<li><strong>${escapeHtml(artifact.filename)}</strong> · ${formatRelativeDate(artifact.created_at)} (extraction ${artifact.extract?.extraction_status || "pending"})</li>`,
      )
      .join("");
    artifactItems += fallbackItems;
  }

  if (!artifactItems) {
    artifactItems = "<li>No supporting artifacts uploaded yet.</li>";
  }

  // Build goals from extracted content, fallback to generic if none found
  let goalsHtml = "";
  if (objectives.length > 0) {
    goalsHtml = `<ul>${objectives.map(obj => `<li>${escapeHtml(obj)}</li>`).join("")}</ul>`;
  } else if (successMetrics.length > 0) {
    goalsHtml = `<ul>${successMetrics.map(metric => `<li>${escapeHtml(metric)}</li>`).join("")}</ul>`;
  } else {
    goalsHtml = `<ul><li>Deliver a high-confidence proposal with clear ROI evidence.</li><li>Align stakeholders on scope, constraints, and success metrics.</li><li>Ensure approvals are auditable via the stage timeline.</li></ul>`;
  }

  // Build scope section if we have scope items
  let scopeHtml = "";
  if (scopeItems.length > 0 || keyRequirements.length > 0) {
    const allScope = [...scopeItems, ...keyRequirements.slice(0, 3)];
    scopeHtml = `<h3>Project Scope</h3><ul>${allScope.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  return [
    `<h3>Executive Summary</h3>`,
    `<p>Project <strong>${escapeHtml(detail.estimate.name)}</strong> led by <strong>${escapeHtml(detail.estimate.owner)}</strong> is currently tracking through the <em>${escapeHtml(detail.estimate.stage)}</em> stage.</p>`,
    `<h3>Goals &amp; Outcomes</h3>`,
    goalsHtml,
    scopeHtml,
    `<h3>Supporting Artifacts</h3>`,
    `<ul>${artifactItems}</ul>`,
    `<h3>Next Steps</h3>`,
    `<ol><li>Review this draft with delivery and finance stakeholders.</li><li>Capture final edits directly in the editor.</li><li>Approve to unlock the Requirements stage.</li></ol>`,
  ].join("");
}

function formatRelativeDate(value: string) {
  try {
    const date = new Date(value);
    return date.toLocaleDateString();
  } catch {
    return value;
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Clean artifact content by removing metadata, headers, and export info
 */
function cleanArtifactContent(content: string): string {
  // Remove common markdown metadata patterns
  let cleaned = content
    // Remove export metadata (e.g., "_Exported on...")
    .replace(/^_Exported on[^\n]*\n/gm, "")
    // Remove file path references at start
    .replace(/^#\s+.*\.md\s*$/gm, "")
    // Remove "from Cursor" type metadata
    .replace(/from Cursor[^\n]*/gi, "")
    // Remove horizontal rules used as separators
    .replace(/^---+\s*$/gm, "")
    // Remove excessive whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Find the first meaningful content (skip headers/metadata)
  const lines = cleaned.split("\n");
  let startIndex = 0;
  
  // Skip lines that look like metadata
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim();
    // Skip empty lines, export metadata, or very short header-only lines
    if (line && !line.match(/^(Exported|from|#\s*$)/i) && line.length > 10) {
      startIndex = i;
      break;
    }
  }
  
  return lines.slice(startIndex).join("\n").trim();
}

export async function POST(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id: estimateId } = await context.params;
  const supabase = getSupabaseServiceRoleClient();
  const detail = await fetchEstimateDetail(supabase, estimateId);
  if (!detail) {
    return NextResponse.json({ error: "Estimate not found" }, { status: 404 });
  }

  const generatedContent = composeBusinessCase(detail);

  await upsertBusinessCase(supabase, estimateId, {
    content: generatedContent,
    approved: false,
    approved_by: null,
  });

  await logTimelineEntry(
    supabase,
    estimateId,
    "Business Case",
    "Business Case generated by Copilot",
    "Copilot",
  );

  const updatedDetail = await fetchEstimateDetail(supabase, estimateId);
  return NextResponse.json(updatedDetail, { status: 200 });
}

