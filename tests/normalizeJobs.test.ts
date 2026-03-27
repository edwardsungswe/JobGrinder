import { describe, expect, it } from "vitest";
import { normalizeJobs } from "../src/ingest/normalizeJobs.js";
import type { JobRecord } from "../src/types/job.js";

describe("normalizeJobs", () => {
  it("maps common columns and removes duplicates", () => {
    const rows: JobRecord[] = [
      {
        sourceRowNumber: 1,
        raw: {
          "Position Title": "Backend Engineer",
          Company: "Acme",
          Location: "Remote",
          Apply: "https://example.com/jobs/1",
          Salary: "$180,000",
          Qualifications: "TypeScript APIs",
          "Work Model": "Remote",
          Date: "2026-03-26",
        },
      },
      {
        sourceRowNumber: 2,
        raw: {
          "Position Title": "Backend Engineer",
          Company: "Acme",
          Location: "Remote",
          Apply: "https://example.com/jobs/1",
          Salary: "$180,000",
          Qualifications: "Duplicate row",
          "Work Model": "Remote",
          Date: "2026-03-26",
        },
      },
    ];

    const normalized = normalizeJobs(rows);
    expect(normalized).toHaveLength(1);
    expect(normalized[0]?.["Position Title"]).toBe("Backend Engineer");
    expect(normalized[0]?.Apply).toBe("https://example.com/jobs/1");
    expect(normalized[0]?.["Work Model"]).toBe("Remote");
    expect(normalized[0]?.Date).toBe("2026-03-26");
  });
});
