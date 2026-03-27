import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OllamaScoreProvider,
  buildOllamaPrompt,
  parseOllamaResponseText,
} from "../src/scoring/ollamaScoreProvider.js";
import type { ScoringJobRecord } from "../src/types/job.js";
import type { Profile } from "../src/types/profile.js";

const job: ScoringJobRecord = {
  sourceRowNumber: 1,
  sourceId: "job-1",
  title: "Backend Engineer",
  company: "Acme",
  location: "Remote",
  url: "https://example.com/jobs/1",
  description: "Build Node and TypeScript APIs.",
  workModel: "Remote",
  employmentType: "full-time",
  seniority: "senior",
  compensationText: "$180,000",
  compensationBaseUsd: 180000,
  postedAt: "2026-03-26",
  fields: {},
};

const profile: Profile = {
  name: "Test User",
  summary: "Backend engineer focused on TypeScript product work.",
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
    excludedCompanies: [],
    weightingHints: [],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("ollama prompt helpers", () => {
  it("builds a compact prompt with profile and job context", () => {
    const prompt = buildOllamaPrompt(job, profile);
    expect(prompt).toContain("Return JSON only.");
    expect(prompt).toContain('"targetTitles":["Backend Engineer"]');
    expect(prompt).toContain('"title":"Backend Engineer"');
  });

  it("parses valid JSON response text", () => {
    expect(
      parseOllamaResponseText(
        JSON.stringify({
          score: 91,
          rationale: "Strong match.",
          matchingFactors: ["backend"],
          redFlags: [],
          recommendation: "yes",
        }),
      ),
    ).toEqual({
      score: 91,
      rationale: "Strong match.",
      matchingFactors: ["backend"],
      redFlags: [],
      recommendation: "yes",
    });
  });

  it("rejects invalid JSON response text", () => {
    expect(() => parseOllamaResponseText("not json")).toThrow();
  });

  it("rejects response objects missing required fields", () => {
    expect(() =>
      parseOllamaResponseText(
        JSON.stringify({
          score: 42,
          rationale: "Missing recommendation.",
          matchingFactors: [],
          redFlags: [],
        }),
      ),
    ).toThrow();
  });
});

describe("OllamaScoreProvider", () => {
  it("retries once when the first response is not valid JSON", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ response: "not json" }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            response: JSON.stringify({
              score: 84,
              rationale: "Recovered on retry.",
              matchingFactors: ["typescript"],
              redFlags: [],
              recommendation: "yes",
            }),
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const provider = new OllamaScoreProvider({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen2.5:7b",
      timeoutMs: 5_000,
    });

    const result = await provider.score(job, profile);
    expect(result.recommendation).toBe("yes");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("surfaces model-not-found errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: "model 'qwen2.5:7b' not found" }), {
          status: 404,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    const provider = new OllamaScoreProvider({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen2.5:7b",
      timeoutMs: 5_000,
    });

    await expect(provider.score(job, profile)).rejects.toThrow(/not found/);
  });

  it("surfaces connection errors when Ollama is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("connect ECONNREFUSED")));

    const provider = new OllamaScoreProvider({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen2.5:7b",
      timeoutMs: 5_000,
    });

    await expect(provider.score(job, profile)).rejects.toThrow(/Could not reach Ollama/);
  });

  it("surfaces timeout errors", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn((_: RequestInfo | URL, init?: RequestInit) => {
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
        });
      }),
    );

    const provider = new OllamaScoreProvider({
      baseUrl: "http://127.0.0.1:11434",
      model: "qwen2.5:7b",
      timeoutMs: 100,
    });

    const pending = provider.score(job, profile);
    const assertion = expect(pending).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(100);
    await assertion;
  });
});
