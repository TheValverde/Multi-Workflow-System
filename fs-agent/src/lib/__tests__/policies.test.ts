import { describe, expect, it } from "vitest";
import { normalizeTags } from "@/lib/policies";

describe("normalizeTags", () => {
  it("handles undefined input", () => {
    expect(normalizeTags()).toEqual([]);
  });

  it("splits comma-delimited string", () => {
    expect(normalizeTags("finance, legal , ,SLA")).toEqual([
      "finance",
      "legal",
      "SLA",
    ]);
  });

  it("deduplicates array entries", () => {
    expect(
      normalizeTags(["billing", "billing  ", "  delivery", ""]),
    ).toEqual(["billing", "billing", "delivery"]);
  });
});

