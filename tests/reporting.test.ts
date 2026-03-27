import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateReport } from "../src/reporting/generateReport.js";
import type { ScoredJobRecord } from "../src/types/job.js";

describe("generateReport", () => {
  it("writes a markdown report", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "jobgrinder-report-"));
    const scoredJobs: ScoredJobRecord[] = [
      {
        sourceRowNumber: 1,
        sourceId: "1",
        title: "Backend Engineer",
        company: "Acme",
        location: "Remote",
        url: "https://example.com/job",
        description: "TypeScript APIs",
        workModel: "Remote",
        employmentType: "full-time",
        seniority: "senior",
        compensationText: "$180,000",
        compensationBaseUsd: 180000,
        postedAt: "2026-03-26",
        fields: {},
        deterministicDecision: "yes",
        deterministicReasons: ["Passed deterministic filters"],
        score: 90,
        rationale: "Strong overlap",
        matchingFactors: ["backend", "typescript"],
        redFlags: [],
        recommendation: "yes",
        provider: "mock",
      },
    ];

    const { reportPath } = await generateReport({ scoredJobs, outputDir: tempDir });
    const contents = await readFile(reportPath, "utf8");
    expect(contents).toContain("Backend Engineer at Acme");
    expect(contents).toContain("Apply Now");
  });
});
