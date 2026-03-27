import { describe, expect, it } from "vitest";
import { prefilterJob } from "../src/scoring/prefilter.js";
import type { ScoringJobRecord } from "../src/types/job.js";
import type { Profile } from "../src/types/profile.js";

const profile: Profile = {
  name: "Test User",
  summary: "Backend engineer",
  targetTitles: ["Backend Engineer"],
  includeKeywords: ["typescript", "node"],
  excludeKeywords: ["contract"],
  seniority: ["senior"],
  locations: {
    allowed: ["remote"],
    remoteOnly: false,
  },
  compensation: {
    minimumBaseUsd: 150000,
  },
  preferences: {
    employmentTypes: {
      include: ["full-time"],
      exclude: ["contract"],
    },
    excludedCompanies: ["BadCorp"],
    weightingHints: [],
  },
};

const baseJob: ScoringJobRecord = {
  sourceRowNumber: 1,
  sourceId: "1",
  title: "Backend Engineer",
  company: "Acme",
  location: "Remote",
  url: "https://example.com/job",
  description: "TypeScript and Node APIs",
  workModel: "Remote",
  employmentType: "full-time",
  seniority: "senior",
  compensationText: "$170,000",
  compensationBaseUsd: 170000,
  postedAt: "2026-03-26",
  fields: {},
};

describe("prefilterJob", () => {
  it("accepts a strong matching job", () => {
    expect(prefilterJob(baseJob, profile)).toEqual({
      decision: "yes",
      reasons: ["Passed deterministic filters"],
    });
  });

  it("rejects excluded companies", () => {
    expect(
      prefilterJob(
        {
          ...baseJob,
          company: "BadCorp Labs",
        },
        profile,
      ),
    ).toEqual({
      decision: "no",
      reasons: ["Excluded company: BadCorp"],
    });
  });
});
