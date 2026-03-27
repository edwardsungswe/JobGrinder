import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { normalizeJobs, toScoringJobRecord } from "../src/ingest/normalizeJobs.js";
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
  it("scores normalized jobs through Ollama and preserves deterministic metadata", async () => {
    const fixturePath = path.join(process.cwd(), "tests", "fixtures", "sample-airtable.csv");
    const tempDir = await mkdtemp(path.join(os.tmpdir(), "jobgrinder-score-"));
    const rows = await parseCsvFile(fixturePath);
    const normalized = normalizeJobs(rows);
    const scoringJobs = normalized.map((job, index) => toScoringJobRecord(job, index + 1));
    const fetchMock = vi.fn().mockImplementation(() =>
      Promise.resolve(
        new Response(
          JSON.stringify({
            response: JSON.stringify({
              score: 88,
              rationale: "Strong alignment with backend TypeScript preferences.",
              matchingFactors: ["backend", "typescript"],
              redFlags: [],
              recommendation: "yes",
            }),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    vi.stubGlobal("fetch", fetchMock);

    const { scoredJobs } = await scoreJobs({
      jobs: scoringJobs,
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
    expect(scoredJobs[0]?.title).toBe("Backend Engineer");
    expect(scoredJobs[0]?.provider).toBe("ollama");
    expect(scoredJobs.find((job) => job.company === "TalentShop")?.deterministicDecision).toBe("no");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
