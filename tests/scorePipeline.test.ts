import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeJobs } from "../src/ingest/normalizeJobs.js";
import { parseCsvFile } from "../src/ingest/parseCsv.js";
import { OllamaScoreProvider } from "../src/scoring/ollamaScoreProvider.js";
import { scoreJobs } from "../src/scoring/scoreJobs.js";
import type { Profile } from "../src/types/profile.js";
import { Logger } from "../src/utils/logger.js";

const profile: Profile = {
  name: "Test User",
  summary: "Backend engineer focused on TypeScript product work.",
  targetTitles: ["Backend Engineer", "Software Engineer"],
  includeKeywords: ["typescript", "node", "backend"],
  excludeKeywords: ["recruiter", "contract"],
  seniority: ["mid", "senior"],
  locations: {
    allowed: ["remote", "new york"],
    remoteOnly: false,
  },
  compensation: {
    minimumBaseUsd: 150000,
    minimumHourlyUsd: 30,
    reputableCompaniesOnMissingCompensation: ["Google"],
  },
  preferences: {
    employmentTypes: {
      include: ["full-time"],
      exclude: ["contract"],
    },
    excludedCompanies: [],
    weightingHints: [],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("score pipeline", () => {
  it("filters normalized jobs and calls Ollama for unresolved company or qualification cases", async () => {
    const fixturePath = path.join(process.cwd(), "tests", "fixtures", "sample-airtable.csv");
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "jobgrinder-score-"));
    const rows = await parseCsvFile(fixturePath);
    const normalized = normalizeJobs(rows);
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            response: JSON.stringify({
              keep: false,
              rationale: "Not a strong fit.",
              redFlags: ["role mismatch"],
            }),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const { scoredJobs } = await scoreJobs({
      jobs: normalized,
      profile,
      provider: new OllamaScoreProvider({
        baseUrl: "http://127.0.0.1:11434",
        model: "qwen2.5:7b",
        timeoutMs: 5_000,
      }),
      processedDir: tempDir,
      logger: new Logger("error"),
    });

    expect(scoredJobs).toHaveLength(3);
    expect(scoredJobs[0]?.["Position Title"]).toBe("Backend Engineer");
    expect(scoredJobs[0]?.provider).toBe("deterministic");
    expect(scoredJobs[0]?.keep).toBe(true);
    expect(scoredJobs.find((job) => job.Company === "TalentShop")?.keep).toBe(false);
    expect(scoredJobs.find((job) => job.Company === "DesignCo")?.provider).toBe("ollama");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
