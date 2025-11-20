import type { EstimateDetail } from "@/lib/estimates";
import { STAGE_ORDER, getStageIndex } from "@/lib/stages";

export type GateStatus = {
  passed: boolean;
  message: string;
  blocking?: boolean; // If true, prevents stage advancement
};

export type StageGateInfo = {
  stage: string;
  entryCriteria: GateStatus[];
  readyToAdvance: GateStatus[];
  canAdvance: boolean;
  canAccess: boolean; // Whether the stage panel can be edited
};

export type StageGates = {
  [stage: string]: StageGateInfo;
};

export function buildStageGateStatus(
  detail: EstimateDetail | null,
  localPaymentTerms?: string,
): StageGates {
  if (!detail) {
    return {};
  }

  const currentStageIndex = getStageIndex(detail.estimate.stage);
  const gates: StageGates = {};

  // Artifacts Stage
  const artifactCount = detail.artifacts.length;
  gates["Artifacts"] = {
    stage: "Artifacts",
    entryCriteria: [],
    readyToAdvance: [
      {
        passed: artifactCount >= 2,
        message: artifactCount >= 2
          ? `✓ ${artifactCount} artifacts uploaded`
          : `Need 2 artifacts (currently ${artifactCount})`,
        blocking: true,
      },
    ],
    canAdvance: artifactCount >= 2,
    canAccess: true, // Always accessible
  };

  // Business Case Stage
  const businessCaseHasContent =
    detail.businessCase?.content &&
    extractPlainText(detail.businessCase.content).length > 0;
  const businessCaseApproved = detail.businessCase?.approved ?? false;
  const artifactsReady = artifactCount >= 2;

  gates["Business Case"] = {
    stage: "Business Case",
    entryCriteria: [
      {
        passed: artifactsReady,
        message: artifactsReady
          ? "✓ 2+ artifacts uploaded"
          : "Need 2 artifacts to unlock Business Case",
        blocking: true,
      },
    ],
    readyToAdvance: [
      {
        passed: businessCaseHasContent,
        message: businessCaseHasContent
          ? "✓ Business Case generated/edited"
          : "Business Case needs to be generated or edited",
        blocking: true,
      },
      {
        passed: businessCaseApproved,
        message: businessCaseApproved
          ? "✓ Business Case approved"
          : "Business Case needs approval",
        blocking: true,
      },
    ],
    canAdvance: businessCaseHasContent && businessCaseApproved,
    canAccess: artifactsReady, // Locked until artifacts ready
  };

  // Requirements Stage
  const requirementsHasContent =
    detail.requirements?.content &&
    extractPlainText(detail.requirements.content).length > 0;
  const requirementsValidated = detail.requirements?.validated ?? false;

  gates["Requirements"] = {
    stage: "Requirements",
    entryCriteria: [
      {
        passed: businessCaseApproved,
        message: businessCaseApproved
          ? "✓ Business Case approved"
          : "Business Case must be approved first",
        blocking: true,
      },
    ],
    readyToAdvance: [
      {
        passed: requirementsHasContent,
        message: requirementsHasContent
          ? "✓ Requirements generated/edited"
          : "Requirements need to be generated or edited",
        blocking: true,
      },
      {
        passed: requirementsValidated,
        message: requirementsValidated
          ? "✓ Requirements validated"
          : "Requirements need validation",
        blocking: true,
      },
    ],
    canAdvance: requirementsHasContent && requirementsValidated,
    canAccess: businessCaseApproved, // Locked until Business Case approved
  };

  // Solution/Architecture Stage
  const solutionHasContent =
    detail.solutionArchitecture?.content &&
    extractPlainText(detail.solutionArchitecture.content).length > 0;
  const solutionApproved = detail.solutionArchitecture?.approved ?? false;

  gates["Solution/Architecture"] = {
    stage: "Solution/Architecture",
    entryCriteria: [
      {
        passed: requirementsValidated,
        message: requirementsValidated
          ? "✓ Requirements validated"
          : "Requirements must be validated first",
        blocking: true,
      },
    ],
    readyToAdvance: [
      {
        passed: solutionHasContent,
        message: solutionHasContent
          ? "✓ Solution & Architecture documented"
          : "Solution & Architecture needs to be generated or edited",
        blocking: true,
      },
      {
        passed: solutionApproved,
        message: solutionApproved
          ? "✓ Solution & Architecture approved"
          : "Solution & Architecture needs approval",
        blocking: true,
      },
    ],
    canAdvance: solutionHasContent && solutionApproved,
    canAccess: requirementsValidated,
  };

  // Effort Estimate Stage
  const hasWbsRows = (detail.effortEstimate?.rows?.length ?? 0) > 0;
  const effortEstimateApproved = detail.effortEstimate?.approvedVersion != null;

  gates["Effort Estimate"] = {
    stage: "Effort Estimate",
    entryCriteria: [
      {
        passed: requirementsValidated,
        message: requirementsValidated
          ? "✓ Requirements validated"
          : "Requirements must be validated first",
        blocking: true,
      },
    ],
    readyToAdvance: [
      {
        passed: hasWbsRows,
        message: hasWbsRows
          ? "✓ WBS generated/edited"
          : "WBS needs to be generated",
        blocking: true,
      },
      {
        passed: effortEstimateApproved,
        message: effortEstimateApproved
          ? "✓ Effort Estimate approved"
          : "Effort Estimate needs approval",
        blocking: true,
      },
    ],
    canAdvance: hasWbsRows && effortEstimateApproved,
    canAccess: requirementsValidated,
  };

  // Quote Stage
  const hasRates = detail.quote?.rates?.length > 0;
  // Check both saved payment_terms and any local draft state
  const savedPaymentTerms = detail.quote?.payment_terms?.trim() || "";
  const localPaymentTermsValue = localPaymentTerms?.trim() || "";
  const hasPaymentTerms = savedPaymentTerms.length > 0 || localPaymentTermsValue.length > 0;
  const quoteReady = hasRates && hasPaymentTerms;

  gates["Quote"] = {
    stage: "Quote",
    entryCriteria: [
      {
        passed: effortEstimateApproved,
        message: effortEstimateApproved
          ? "✓ Effort Estimate approved"
          : "Effort Estimate must be approved first",
        blocking: true,
      },
    ],
    readyToAdvance: [
      {
        passed: hasRates,
        message: hasRates
          ? "✓ Rates configured"
          : "Missing rates",
        blocking: false,
      },
      {
        passed: hasPaymentTerms,
        message: hasPaymentTerms
          ? "✓ Payment terms set"
          : "Missing payment terms",
        blocking: false,
      },
    ],
    canAdvance: quoteReady,
    canAccess: effortEstimateApproved,
  };

  return gates;
}

function extractPlainText(html: string): string {
  if (typeof document === "undefined") {
    return html.replace(/<[^>]*>/g, "").trim();
  }
  const div = document.createElement("div");
  div.innerHTML = html;
  return div.textContent || div.innerText || "";
}

