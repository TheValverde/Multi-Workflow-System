import type { EstimateDetail } from "./estimates";

export type GeneratedWbsRow = {
  taskCode?: string | null;
  description: string;
  role: string;
  hours: number;
  assumptions?: string | null;
};

export function generateWbsFromDetail(
  detail: EstimateDetail,
): GeneratedWbsRow[] {
  const requirementHighlights = extractRequirementHighlights(
    detail.requirements.content,
  );
  const artifactSnippets = detail.artifacts.slice(0, 2).map((artifact) => ({
    taskCode: `ART-${artifact.filename.slice(0, 3).toUpperCase()}-${Math.floor(
      Math.random() * 900 + 100,
    )}`,
    description: `Ingest ${artifact.filename} and capture key deliverables.`,
    role: "Discovery Lead",
    hours: 6,
    assumptions: "Focus on scope and constraints documented in the artifact.",
  }));

  const baseRows: GeneratedWbsRow[] = [
    {
      taskCode: "DISC-101",
      description: "Run discovery + alignment workshop with stakeholders.",
      role: "Engagement Lead",
      hours: 12,
      assumptions: "Stakeholders available for two 90-min sessions.",
    },
    {
      taskCode: "ARCH-110",
      description:
        "Draft solution approach covering architecture, risks, and dependencies.",
      role: "Solutions Architect",
      hours: 16,
      assumptions:
        "Re-use previous architectures referenced in Business Case where applicable.",
    },
    {
      taskCode: "PLAN-210",
      description:
        "Translate requirements into role-based task plan with sequencing.",
      role: "Project Planner",
      hours: 10,
      assumptions: "Requirements are validated and signed off.",
    },
    {
      taskCode: "BACK-330",
      description: "Estimate backend/API build tasks aligned to requirements.",
      role: "Backend Engineer",
      hours: 32,
      assumptions: "Includes CRUD endpoints and integrations already scoped.",
    },
    {
      taskCode: "QA-450",
      description:
        "Define QA strategy, write smoke/regression plan, and size effort.",
      role: "QA Lead",
      hours: 14,
      assumptions: "Automation not in scope for initial delivery.",
    },
  ];

  const requirementRows = requirementHighlights.map((highlight, index) => ({
    taskCode: `REQ-${index + 1}`.padStart(3, "0"),
    description: `Deep dive requirement: ${highlight}`,
    role: index % 2 === 0 ? "Business Analyst" : "Technical Lead",
    hours: 6 + index * 2,
    assumptions: "Assumes requirement remains in scope for current release.",
  }));

  const combined = [...artifactSnippets, ...baseRows, ...requirementRows];

  if (combined.length < 5) {
    while (combined.length < 5) {
      combined.push({
        description: "General engineering buffer",
        role: "Engineering Lead",
        hours: 8,
        assumptions: "Covers unforeseen spikes or clarifications.",
      });
    }
  }

  return combined.map((row, index) => ({
    ...row,
    taskCode: row.taskCode ?? `WBS-${String(index + 1).padStart(3, "0")}`,
    hours: Math.max(1, Math.round(row.hours)),
  }));
}

export function extractRequirementHighlights(
  content: string | null,
  maxCount = 3,
): string[] {
  if (!content) return [];
  const plain = content
    .replace(/<[^>]+>/g, "\n")
    .replace(/&nbsp;/g, " ")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
  return plain.slice(0, maxCount);
}

