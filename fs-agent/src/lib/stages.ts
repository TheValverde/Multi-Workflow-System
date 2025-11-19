export type StageKey =
  | "Artifacts"
  | "Business Case"
  | "Requirements"
  | "Solution/Architecture"
  | "Effort Estimate"
  | "Quote";

export type StageMeta = {
  key: StageKey;
  title: string;
  description: string;
};

export const STAGES: StageMeta[] = [
  {
    key: "Artifacts",
    title: "Artifacts",
    description: "Collect kickoff materials and ensure at least two reference files.",
  },
  {
    key: "Business Case",
    title: "Business Case",
    description: "Generate and approve the value statement and success metrics.",
  },
  {
    key: "Requirements",
    title: "Requirements",
    description: "Capture the definitive list of requirements and validation notes.",
  },
  {
    key: "Solution/Architecture",
    title: "Solution & Architecture",
    description: "Outline the proposed implementation approach and risks.",
  },
  {
    key: "Effort Estimate",
    title: "Effort Estimate",
    description: "Produce the WBS, role allocations, and estimates.",
  },
  {
    key: "Quote",
    title: "Quote",
    description: "Finalize pricing, payment terms, and approvals.",
  },
];

export const STAGE_ORDER = STAGES.map((stage) => stage.key);

export const getStageIndex = (stage: string | null | undefined): number =>
  STAGE_ORDER.findIndex((value) => value === stage);

export const getNextStage = (stage: string): StageKey | null => {
  const idx = getStageIndex(stage);
  if (idx === -1 || idx === STAGE_ORDER.length - 1) {
    return null;
  }
  return STAGE_ORDER[idx + 1] as StageKey;
};

export const isFinalStage = (stage: string | null | undefined): boolean => {
  const idx = getStageIndex(stage ?? "");
  return idx === STAGE_ORDER.length - 1;
};

