import { describe, expect, it } from "vitest";
import { filterRecentJobs } from "../src/ingest/filterRecentJobs.js";
import type { NormalizedJobRecord } from "../src/types/job.js";

const jobs: NormalizedJobRecord[] = [
  {
    "Position Title": "Old Job",
    Date: "2026-03-20",
    Apply: "https://example.com/1",
    "Work Model": "Remote",
    Location: "Remote",
    Company: "Acme",
    Salary: "",
    "Hire Time": "",
    "Graduate Time": "",
    "Company Industry": "",
    "Company Size": "",
    Qualifications: "",
  },
  {
    "Position Title": "Newest Job",
    Date: "2026-03-26",
    Apply: "https://example.com/2",
    "Work Model": "Remote",
    Location: "Remote",
    Company: "Beta",
    Salary: "",
    "Hire Time": "",
    "Graduate Time": "",
    "Company Industry": "",
    "Company Size": "",
    Qualifications: "",
  },
  {
    "Position Title": "Middle Job",
    Date: "2026-03-24",
    Apply: "https://example.com/3",
    "Work Model": "Remote",
    Location: "Remote",
    Company: "Gamma",
    Salary: "",
    "Hire Time": "",
    "Graduate Time": "",
    "Company Industry": "",
    "Company Size": "",
    Qualifications: "",
  },
];

describe("filterRecentJobs", () => {
  it("keeps only the most recent X jobs by posted date", () => {
    const filtered = filterRecentJobs(jobs, 2);
    expect(filtered).toHaveLength(2);
    expect(filtered[0]?.["Position Title"]).toBe("Newest Job");
    expect(filtered[1]?.["Position Title"]).toBe("Middle Job");
  });
});
