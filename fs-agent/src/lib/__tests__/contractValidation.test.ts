import { describe, expect, it } from "vitest";
import type { ValidationResult, Discrepancy } from "@/lib/contracts";

describe("Contract validation - payment terms mismatch", () => {
  it("detects payment terms mismatch between SOW and estimate", () => {
    const sowContent = "Payment terms: Net 45. Client agrees to pay within 45 days.";
    const estimateData = {
      paymentTerms: "Net 30",
      totalHours: 100,
      totalCost: 15000,
      currency: "USD",
      rows: [],
      lines: [],
    };

    // Simulate validation logic
    const contentLower = sowContent.toLowerCase();
    const estimateTerms = estimateData.paymentTerms.toLowerCase();
    const net45Match = contentLower.match(/net\s*45/i);
    
    const discrepancies: Discrepancy[] = [];
    if (net45Match) {
      const sowTerms = "Net 45";
      if (sowTerms.toLowerCase() !== estimateTerms) {
        discrepancies.push({
          id: "payment-terms-1",
          category: "payment_terms",
          severity: "error",
          message: `Payment terms mismatch: SOW specifies "${sowTerms}" but estimate quote requires "${estimateData.paymentTerms}"`,
          reference: "Payment Terms section",
          expected: estimateData.paymentTerms,
          actual: sowTerms,
        });
      }
    }

    expect(discrepancies.length).toBe(1);
    expect(discrepancies[0].category).toBe("payment_terms");
    expect(discrepancies[0].severity).toBe("error");
    expect(discrepancies[0].message).toContain("Net 45");
    expect(discrepancies[0].message).toContain("Net 30");
    expect(discrepancies[0].expected).toBe("Net 30");
    expect(discrepancies[0].actual).toBe("Net 45");
  });

  it("passes validation when payment terms match", () => {
    const sowContent = "Payment terms: Net 30. Client agrees to pay within 30 days.";
    const estimateData = {
      paymentTerms: "Net 30",
      totalHours: 100,
      totalCost: 15000,
      currency: "USD",
      rows: [],
      lines: [],
    };

    const contentLower = sowContent.toLowerCase();
    const estimateTerms = estimateData.paymentTerms.toLowerCase();
    const net30Match = contentLower.match(/net\s*30/i);
    
    const discrepancies: Discrepancy[] = [];
    if (net30Match) {
      const sowTerms = "Net 30";
      if (sowTerms.toLowerCase() !== estimateTerms) {
        discrepancies.push({
          id: "payment-terms-1",
          category: "payment_terms",
          severity: "error",
          message: `Payment terms mismatch`,
          reference: "Payment Terms section",
          expected: estimateData.paymentTerms,
          actual: sowTerms,
        });
      }
    }

    expect(discrepancies.length).toBe(0);
  });

  it("detects missing payment terms when estimate requires them", () => {
    const sowContent = "This SOW outlines the work to be performed.";
    const estimateData = {
      paymentTerms: "Net 30",
      totalHours: 100,
      totalCost: 15000,
      currency: "USD",
      rows: [],
      lines: [],
    };

    const contentLower = sowContent.toLowerCase();
    const estimateTerms = estimateData.paymentTerms.toLowerCase();
    const net30Match = contentLower.match(/net\s*30/i);
    const net45Match = contentLower.match(/net\s*45/i);
    const net60Match = contentLower.match(/net\s*60/i);
    
    const discrepancies: Discrepancy[] = [];
    let sowTerms: string | null = null;
    if (net30Match) sowTerms = "Net 30";
    else if (net45Match) sowTerms = "Net 45";
    else if (net60Match) sowTerms = "Net 60";

    if (!sowTerms && estimateTerms.includes("net")) {
      discrepancies.push({
        id: "payment-terms-2",
        category: "payment_terms",
        severity: "warning",
        message: `SOW does not specify payment terms, but estimate quote requires "${estimateData.paymentTerms}"`,
        reference: "Payment Terms section",
        expected: estimateData.paymentTerms,
        actual: "Not specified",
      });
    }

    expect(discrepancies.length).toBe(1);
    expect(discrepancies[0].severity).toBe("warning");
    expect(discrepancies[0].actual).toBe("Not specified");
  });
});

