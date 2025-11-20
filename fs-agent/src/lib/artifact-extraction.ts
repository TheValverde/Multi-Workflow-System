import mammoth from "mammoth";

export type ExtractionResult = {
  contentText: string;
  contentHtml: string;
  summary?: string;
  error?: string;
};

/**
 * Extract text from a Markdown file
 */
export async function extractMarkdown(
  fileContent: Buffer | ArrayBuffer,
): Promise<ExtractionResult> {
  try {
    const text = new TextDecoder("utf-8").decode(
      fileContent instanceof ArrayBuffer ? fileContent : fileContent.buffer,
    );
    
    // Clean the text to remove metadata
    const cleaned = cleanMarkdownMetadata(text);
    
    // For Markdown, we can use the text directly
    // Optionally convert to HTML using a markdown parser
    const html = markdownToHtml(cleaned);
    
    // Generate a better summary (first meaningful paragraph or sentences)
    const summary = generateSummary(cleaned, 200);
    
    return {
      contentText: cleaned,
      contentHtml: html,
      summary,
    };
  } catch (error) {
    return {
      contentText: "",
      contentHtml: "",
      error: error instanceof Error ? error.message : "Failed to extract Markdown",
    };
  }
}

/**
 * Extract text from a DOCX file
 */
export async function extractDocx(
  fileContent: Buffer | ArrayBuffer,
): Promise<ExtractionResult> {
  try {
    const buffer =
      fileContent instanceof ArrayBuffer
        ? Buffer.from(fileContent)
        : fileContent;

    // Use mammoth to convert DOCX to HTML
    const result = await mammoth.convertToHtml({ buffer });
    const html = result.value;
    
    // Extract plain text from HTML (remove tags)
    const text = htmlToPlainText(html);
    
    // Clean the text to remove any metadata
    const cleaned = cleanMarkdownMetadata(text);
    
    // Get any warnings from mammoth
    const warnings = result.messages
      .filter((msg) => msg.type === "warning")
      .map((msg) => msg.message)
      .join("; ");

    // Generate a better summary
    const summary = generateSummary(cleaned, 200);

    return {
      contentText: cleaned,
      contentHtml: html,
      summary,
      error: warnings || undefined,
    };
  } catch (error) {
    return {
      contentText: "",
      contentHtml: "",
      error: error instanceof Error ? error.message : "Failed to extract DOCX",
    };
  }
}

/**
 * Simple markdown to HTML converter
 * For production, consider using a library like 'marked' or 'remark'
 */
function markdownToHtml(markdown: string): string {
  // Basic conversion - escape HTML first
  let html = markdown
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Headers
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

  // Bold
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__(.*?)__/g, "<strong>$1</strong>");

  // Italic
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");
  html = html.replace(/_(.*?)_/g, "<em>$1</em>");

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

  // Lists
  html = html.replace(/^\* (.*$)/gim, "<li>$1</li>");
  html = html.replace(/^- (.*$)/gim, "<li>$1</li>");
  html = html.replace(/^(\d+)\. (.*$)/gim, "<li>$2</li>");

  // Wrap list items in <ul> or <ol>
  html = html.replace(/(<li>.*<\/li>)/s, "<ul>$1</ul>");

  // Paragraphs (double newline)
  html = html.split("\n\n").map((p) => {
    if (!p.trim()) return "";
    if (p.startsWith("<h") || p.startsWith("<ul") || p.startsWith("<ol")) {
      return p;
    }
    return `<p>${p.replace(/\n/g, "<br>")}</p>`;
  }).join("");

  return html;
}

/**
 * Convert HTML to plain text by removing tags
 */
function htmlToPlainText(html: string): string {
  return html
    .replace(/<[^>]+>/g, "") // Remove HTML tags
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ") // Normalize whitespace
    .trim();
}

/**
 * Clean markdown/text content by removing metadata patterns
 */
function cleanMarkdownMetadata(text: string): string {
  return text
    // Remove export metadata (e.g., "_Exported on...")
    .replace(/^_Exported on[^\n]*\n/gm, "")
    // Remove "from Cursor" type metadata
    .replace(/from Cursor[^\n]*/gi, "")
    // Remove horizontal rules used as separators
    .replace(/^---+\s*$/gm, "")
    // Remove excessive whitespace
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Generate a summary from content, skipping metadata
 */
function generateSummary(content: string, maxLength: number): string {
  // Find the first meaningful content (skip headers/metadata)
  const lines = content.split("\n");
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
  
  const meaningfulContent = lines.slice(startIndex).join("\n").trim();
  
  // Try to find the first substantial paragraph
  const paragraphs = meaningfulContent.split(/\n\n+/);
  const substantial = paragraphs.find((p) => {
    const cleaned = p.trim();
    return cleaned.length > 50 && !cleaned.match(/^#+\s/);
  });
  
  if (substantial) {
    const summary = substantial.trim();
    if (summary.length <= maxLength) {
      return summary;
    }
    // Truncate at sentence boundary
    const truncated = summary.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf(".");
    if (lastPeriod > maxLength * 0.7) {
      return truncated.substring(0, lastPeriod + 1);
    }
    return truncated + "...";
  }
  
  // Fallback: first few sentences
  const sentences = meaningfulContent.split(/[.!?]\s+/).filter((s) => {
    const cleaned = s.trim();
    return cleaned.length > 20 && !cleaned.match(/^#+\s/);
  });
  
  if (sentences.length > 0) {
    let summary = sentences[0];
    for (let i = 1; i < sentences.length && summary.length < maxLength; i++) {
      const next = summary + ". " + sentences[i];
      if (next.length <= maxLength) {
        summary = next;
      } else {
        break;
      }
    }
    return summary + (summary.length >= maxLength ? "..." : "");
  }
  
  // Last resort: just truncate
  return meaningfulContent.substring(0, maxLength) + 
    (meaningfulContent.length > maxLength ? "..." : "");
}

/**
 * Determine file type from filename or content type
 */
export function getFileType(filename: string, contentType?: string): "md" | "docx" | "unknown" {
  const ext = filename.split(".").pop()?.toLowerCase();
  
  if (ext === "md" || ext === "markdown" || contentType === "text/markdown") {
    return "md";
  }
  
  if (
    ext === "docx" ||
    contentType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  
  return "unknown";
}

/**
 * Extract text from a file based on its type
 */
export async function extractTextFromFile(
  fileContent: Buffer | ArrayBuffer,
  filename: string,
  contentType?: string,
): Promise<ExtractionResult> {
  const fileType = getFileType(filename, contentType);
  
  if (fileType === "md") {
    return extractMarkdown(fileContent);
  }
  
  if (fileType === "docx") {
    return extractDocx(fileContent);
  }
  
  return {
    contentText: "",
    contentHtml: "",
    error: `Unsupported file type: ${filename}. Only .md and .docx files are supported.`,
  };
}

