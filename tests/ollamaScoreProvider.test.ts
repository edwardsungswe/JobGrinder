import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OllamaScoreProvider,
  buildOllamaPrompt,
  parseOllamaResponseText,
} from "../src/scoring/ollamaScoreProvider.js";
import type { NormalizedJobRecord } from "../src/types/job.js";
import type { Profile } from "../src/types/profile.js";

const job: NormalizedJobRecord = {
  "Position Title": "Backend Engineer",
  Date: "2026-03-26",
  Apply: "https://example.com/jobs/1",
  "Work Model": "Remote",
  Location: "Remote",
  Company: "Acme",
  Salary: "$180,000",
  "Hire Time": "full-time",
  "Graduate Time": "",
  "Company Industry": "Software",
  "Company Size": "51-200",
  Qualifications: "Build Node and TypeScript APIs.",
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
  vi.useRealTimers();
});

describe("ollama prompt helpers", () => {
  it("builds a compact prompt with profile and job context", () => {
    const prompt = buildOllamaPrompt(job, profile);
    expect(prompt).toContain("Return JSON only.");
    expect(prompt).toContain('"targetTitles":["Backend Engineer"]');
    expect(prompt).toContain('"Position Title":"Backend Engineer"');
  });

  it("parses valid JSON response text", () => {
    expect(
      parseOllamaResponseText(
        JSON.stringify({
          keep: true,
          rationale: "Strong match.",
          redFlags: [],
        }),
      ),
    ).toEqual({
      keep: true,
      rationale: "Strong match.",
      redFlags: [],
    });
  });

  it("rejects invalid JSON response text", () => {
    expect(() => parseOllamaResponseText("not json")).toThrow();
  });

  it("rejects response objects missing required fields", () => {
    expect(() =>
      parseOllamaResponseText(
        JSON.stringify({
          rationale: "Missing keep.",
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
              keep: true,
              rationale: "Recovered on retry.",
              redFlags: [],
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
    expect(result.keep).toBe(true);
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
