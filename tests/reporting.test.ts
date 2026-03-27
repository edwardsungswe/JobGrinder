import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { generateReport } from "../src/reporting/generateReport.js";
import type { FilteredJobRecord } from "../src/types/job.js";

describe("generateReport", () => {
  it("writes a markdown report", async () => {
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "jobgrinder-report-"));
    const scoredJobs: FilteredJobRecord[] = [
      {
        "Position Title": "Backend Engineer",
        Date: "2026-03-26",
        Apply: "https://example.com/job",
        "Work Model": "Remote",
        Location: "Remote",
        Company: "Acme",
        Salary: "$180,000",
        "Hire Time": "full-time",
        "Graduate Time": "",
        "Company Industry": "Software",
        "Company Size": "51-200",
        Qualifications: "TypeScript APIs",
        keep: true,
        deterministicDecision: "yes",
        deterministicReasons: ["Passed deterministic filters"],
        rationale: "Strong overlap",
        redFlags: [],
        provider: "mock",
      },
    ];

    const { reportPath } = await generateReport({ scoredJobs, outputDir: tempDir });
    const contents = await readFile(reportPath, "utf8");
    expect(contents).toContain("Backend Engineer at Acme");
    expect(contents).toContain("## Apply");
  });
});
