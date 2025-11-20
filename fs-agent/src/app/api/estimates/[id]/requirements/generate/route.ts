import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServiceRoleClient } from "@/lib/supabase";
import {
  fetchEstimateDetail,
  upsertRequirements,
} from "@/lib/estimates";
import { logTimelineEntry } from "@/lib/timeline";

function composeRequirements(detail: Awaited<ReturnType<typeof fetchEstimateDetail>>) {
  if (!detail) {
    return "<p>No requirement data available yet.</p>";
  }

  // Use extracted content from artifacts if available
  const artifactsWithContent = detail.artifacts.filter(
    (a) => a.extract?.extraction_status === "ready" && a.extract.content_text,
  );
  const artifactsWithoutContent = detail.artifacts.filter(
    (a) => !a.extract || a.extract.extraction_status !== "ready",
  );

  let requirementItems = "";
  let reqIndex = 1;

  if (artifactsWithContent.length > 0) {
    // Extract individual requirements from each artifact
    for (const artifact of artifactsWithContent) {
      const extract = artifact.extract!;
      const content = extract.content_text || "";
      
      // Clean and extract meaningful content
      const cleaned = cleanArtifactContent(content);
      
      // Parse into individual requirements (numbered lists, bullets, sections)
      const individualRequirements = parseIndividualRequirements(cleaned, artifact.filename);
      
      // Add each requirement as a separate R item
      for (const req of individualRequirements) {
        requirementItems += `<li><strong>R${reqIndex++}.</strong> From <strong>${escapeHtml(artifact.filename)}</strong>: ${escapeHtml(req)}</li>`;
      }
    }
  }

  if (artifactsWithoutContent.length > 0) {
    const fallbackItems = artifactsWithoutContent
      .map(
        (artifact) =>
          `<li><strong>R${reqIndex++}.</strong> Align insights from ${escapeHtml(artifact.filename)} with stakeholder acceptance criteria. (extraction ${artifact.extract?.extraction_status || "pending"})</li>`,
      )
      .join("");
    requirementItems += fallbackItems;
  }

  if (!requirementItems) {
    requirementItems = "<li><strong>R1.</strong> Capture baseline requirements once artifacts have been uploaded.</li>";
  }

  return [
    `<h3>Functional Requirements</h3>`,
    `<ol>${requirementItems}</ol>`,
    `<h3>Non-Functional Considerations</h3>`,
    `<ul><li>Security: Enforce principle of least privilege and log every approval.</li><li>Performance: Target sub-second responses for common approval actions.</li><li>Reliability: Provide a rollback path for every stage transition.</li></ul>`,
  ].join("");
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

/**
 * Extract key insight from content (prefer first substantial paragraph or list)
 */
function extractKeyInsight(content: string): string {
  // Try to find the first substantial paragraph (50+ chars)
  const paragraphs = content.split(/\n\n+/);
  const substantial = paragraphs.find((p) => p.trim().length > 50);
  
  if (substantial) {
    return substantial.trim();
  }
  
  // Fallback: first few sentences
  const sentences = content.split(/[.!?]\s+/).filter((s) => s.trim().length > 20);
  return sentences.slice(0, 2).join(". ").trim();
}

/**
 * Parse content into individual requirements
 * Extracts numbered items, bullet points, and section-based requirements
 */
function parseIndividualRequirements(content: string, filename: string): string[] {
  const requirements: string[] = [];
  
  // Strategy 1: Extract numbered list items (1., 2., etc.)
  const numberedMatches = content.match(/^\d+\.\s+(.+)$/gm);
  if (numberedMatches && numberedMatches.length > 0) {
    for (const match of numberedMatches.slice(0, 15)) { // Limit to 15 items
      const text = match.replace(/^\d+\.\s+/, "").trim();
      if (text.length > 20 && text.length < 500) {
        requirements.push(text);
      }
    }
  }
  
  // Strategy 2: Extract bullet points (especially in requirement sections)
  const bulletMatches = content.match(/^[-*•]\s+(.+)$/gm);
  if (bulletMatches && bulletMatches.length > 0) {
    // Only use bullets if they're in requirement-relevant sections
    const lines = content.split("\n");
    let inRelevantSection = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check if we're entering a relevant section
      if (line.match(/^##+\s+(requirement|functional|feature|workflow|stage|screen|must-have|deliverable)/i)) {
        inRelevantSection = true;
        continue;
      }
      
      // Check if we're leaving a section (new header)
      if (line.match(/^##+\s/) && !line.match(/(requirement|functional|feature|workflow|stage|screen|must-have|deliverable)/i)) {
        inRelevantSection = false;
        continue;
      }
      
      // Extract bullets in relevant sections
      if (inRelevantSection && line.match(/^[-*•]\s+/)) {
        const text = line.replace(/^[-*•]\s+/, "").trim();
        if (text.length > 20 && text.length < 500 && !requirements.includes(text)) {
          requirements.push(text);
        }
      }
    }
    
    // If no relevant sections found, use first 10 meaningful bullets
    if (requirements.length === 0) {
      for (const match of bulletMatches.slice(0, 10)) {
        const text = match.replace(/^[-*•]\s+/, "").trim();
        if (text.length > 20 && text.length < 500) {
          requirements.push(text);
        }
      }
    }
  }
  
  // Strategy 3: Extract section-based requirements (for structured docs like PRD)
  if (requirements.length < 5) {
    const sections = content.split(/\n(?=##+\s)/);
    for (const section of sections) {
      const header = section.split("\n")[0];
      const isRelevant = header.match(/(requirement|functional|workflow|stage|screen|must-have|deliverable|dashboard|estimates|contracts|copilot)/i);
      
      if (isRelevant) {
        const sectionContent = section.split("\n").slice(1).join("\n").trim();
        
        // Extract key points from the section (first 2-3 paragraphs or sentences)
        const paragraphs = sectionContent.split(/\n\n+/).slice(0, 3);
        for (const para of paragraphs) {
          const cleaned = para.trim();
          if (cleaned.length > 30 && cleaned.length < 400) {
            // Remove markdown formatting but keep content
            const plain = cleaned
              .replace(/\*\*(.+?)\*\*/g, "$1")
              .replace(/\*(.+?)\*/g, "$1")
              .replace(/^#+\s+/gm, "")
              .trim();
            
            if (plain.length > 30 && !requirements.includes(plain)) {
              requirements.push(plain);
            }
          }
        }
      }
    }
  }
  
  // Limit total requirements per artifact to avoid overwhelming
  return requirements.slice(0, 20);
}

/**
 * Truncate text to maxLength, but try to end at a sentence boundary
 */
function truncateToSentence(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  
  // Try to find a sentence boundary near maxLength
  const truncated = text.substring(0, maxLength);
  const lastPeriod = truncated.lastIndexOf(".");
  const lastExclamation = truncated.lastIndexOf("!");
  const lastQuestion = truncated.lastIndexOf("?");
  
  const lastSentenceEnd = Math.max(lastPeriod, lastExclamation, lastQuestion);
  
  if (lastSentenceEnd > maxLength * 0.7) {
    // Found a sentence boundary reasonably close to maxLength
    return truncated.substring(0, lastSentenceEnd + 1).trim();
  }
  
  // No good sentence boundary, just truncate and add ellipsis
  return truncated.trim();
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
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

  const generatedContent = composeRequirements(detail);

  await upsertRequirements(supabase, estimateId, {
    content: generatedContent,
    validated: false,
    validated_by: null,
  });

  await logTimelineEntry(
    supabase,
    estimateId,
    "Requirements",
    "Requirements generated by Copilot",
    "Copilot",
  );

  const updatedDetail = await fetchEstimateDetail(supabase, estimateId);
  return NextResponse.json(updatedDetail, { status: 200 });
}

