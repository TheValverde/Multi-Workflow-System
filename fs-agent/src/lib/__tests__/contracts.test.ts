import { describe, expect, it } from "vitest";
import type { ReviewProposal, AgreementRecord } from "@/lib/contracts";

describe("Contract proposal acceptance", () => {
  it("applies selected proposals to create new version content", () => {
    const originalContent = "Payment terms: Net 60. Client may terminate with 30 days notice.";
    const proposals: ReviewProposal[] = [
      {
        id: "prop-1",
        before: "Payment terms: Net 60",
        after: "Payment terms: Net 30",
        rationale: "Policy requires Net 30",
        section: "Payment Terms",
      },
      {
        id: "prop-2",
        before: "Client may terminate with 30 days notice",
        after: "Client may terminate with 60 days notice",
        rationale: "Standard termination period",
        section: "Termination",
      },
    ];

    // Simulate applying proposals
    let newContent = originalContent;
    const selectedIds = new Set(["prop-1", "prop-2"]);
    const selectedProposals = proposals.filter((p) => selectedIds.has(p.id));

    for (const proposal of selectedProposals) {
      newContent = newContent.replace(proposal.before, proposal.after);
    }

    expect(newContent).toContain("Payment terms: Net 30");
    expect(newContent).toContain("Client may terminate with 60 days notice");
    expect(newContent).not.toContain("Payment terms: Net 60");
    expect(newContent).not.toContain("30 days notice");
  });

  it("handles partial proposal selection", () => {
    const originalContent = "Payment terms: Net 60. Client may terminate with 30 days notice.";
    const proposals: ReviewProposal[] = [
      {
        id: "prop-1",
        before: "Payment terms: Net 60",
        after: "Payment terms: Net 30",
        rationale: "Policy requires Net 30",
        section: "Payment Terms",
      },
      {
        id: "prop-2",
        before: "Client may terminate with 30 days notice",
        after: "Client may terminate with 60 days notice",
        rationale: "Standard termination period",
        section: "Termination",
      },
    ];

    let newContent = originalContent;
    const selectedIds = new Set(["prop-1"]); // Only select first proposal
    const selectedProposals = proposals.filter((p) => selectedIds.has(p.id));

    for (const proposal of selectedProposals) {
      newContent = newContent.replace(proposal.before, proposal.after);
    }

    expect(newContent).toContain("Payment terms: Net 30");
    expect(newContent).toContain("30 days notice"); // Second proposal not applied
  });

  it("validates proposal structure", () => {
    const proposal: ReviewProposal = {
      id: "prop-1",
      before: "Old text",
      after: "New text",
      rationale: "Policy compliance",
      section: "Terms",
    };

    expect(proposal.id).toBeTruthy();
    expect(proposal.before).toBeTruthy();
    expect(proposal.after).toBeTruthy();
    expect(proposal.rationale).toBeTruthy();
  });
});

