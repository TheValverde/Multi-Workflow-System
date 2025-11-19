import { describe, expect, it } from "vitest";
import type { EstimateDetail } from "@/lib/estimates";
import { buildStageEstimatePayload } from "@/lib/stage-estimate";
import { generateWbsFromDetail } from "@/lib/wbs";

const baseDetail: EstimateDetail = {
  estimate: {
    id: "est-123",
    name: "Project Nova",
    owner: "Avery Lee",
    stage: "Effort Estimate",
    updated_at: new Date().toISOString(),
  },
  artifacts: [
    {
      id: "art-1",
      filename: "scope-notes.md",
      storage_path: "scope-notes.md",
      size_bytes: 1200,
      uploaded_by: "Avery",
      created_at: new Date().toISOString(),
      public_url: "https://example.com/scope-notes.md",
    },
  ],
  timeline: [],
  businessCase: {
    id: "bc-1",
    estimate_id: "est-123",
    content: "<p>Sample business case</p>",
    approved: true,
    approved_by: "Avery",
    updated_at: new Date().toISOString(),
  },
  requirements: {
    id: "req-1",
    estimate_id: "est-123",
    content:
      "<ul><li>Support onboarding flows</li><li>Expose reporting APIs</li></ul>",
    validated: true,
    validated_by: "Casey",
    updated_at: new Date().toISOString(),
  },
  effortEstimate: {
    rows: [
      {
        id: "row-1",
        estimate_id: "est-123",
        task_code: "TASK-1",
        description: "Discovery workshop",
        role: "Engagement Lead",
        hours: 10,
        assumptions: null,
        sort_order: 0,
        updated_at: new Date().toISOString(),
      },
      {
        id: "row-2",
        estimate_id: "est-123",
        task_code: "TASK-2",
        description: "Backend estimation",
        role: "Backend Engineer",
        hours: 30,
        assumptions: null,
        sort_order: 1,
        updated_at: new Date().toISOString(),
      },
    ],
    versions: [
      {
        id: "ver-1",
        estimate_id: "est-123",
        version_number: 1,
        actor: "Avery",
        approved: true,
        notes: "Baseline sign-off",
        snapshot: [],
        created_at: new Date().toISOString(),
      },
    ],
    approvedVersion: {
      id: "ver-1",
      estimate_id: "est-123",
      version_number: 1,
      actor: "Avery",
      approved: true,
      notes: "Baseline sign-off",
      snapshot: [],
      created_at: new Date().toISOString(),
    },
  },
};

describe("Stage estimate payload", () => {
  it("summarizes hours and roles", () => {
    const payload = buildStageEstimatePayload(baseDetail);
    expect(payload.totalHours).toBe(40);
    expect(payload.roleSummary["Backend Engineer"]).toBe(30);
    expect(payload.roleSummary["Engagement Lead"]).toBe(10);
    expect(payload.approvedVersion?.version).toBe(1);
  });
});

describe("generateWbsFromDetail", () => {
  it("creates at least five tasks referencing artifacts/requirements", () => {
    const rows = generateWbsFromDetail(baseDetail);
    expect(rows.length).toBeGreaterThanOrEqual(5);
    expect(rows.some((row) => row.description.includes("scope-notes"))).toBe(
      true,
    );
  });
});

