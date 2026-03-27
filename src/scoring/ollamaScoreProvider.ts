import type { AppEnv } from "../types/config.js";
import type { ScoringJobRecord } from "../types/job.js";
import type { Profile } from "../types/profile.js";
import { providerScoreSchema, type ProviderScore, type ScoreProvider } from "./scoreProvider.js";

type OllamaGenerateResponse = {
  response?: string;
  error?: string;
  done?: boolean;
};

export function buildOllamaPrompt(job: ScoringJobRecord, profile: Profile): string {
  return [
    "Score this job for one candidate.",
    "Return JSON only.",
    'JSON keys: score, rationale, matchingFactors, redFlags, recommendation.',
    'recommendation must be one of "yes", "maybe", "no".',
    "score must be an integer from 0 to 100.",
    "matchingFactors and redFlags must be arrays of short strings.",
    `Candidate profile: ${JSON.stringify(profile)}`,
    `Job: ${JSON.stringify(job)}`,
  ].join("\n");
}

export function parseOllamaResponseText(text: string): ProviderScore {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? trimmed;
  return providerScoreSchema.parse(JSON.parse(candidate));
}

async function readResponseJson(response: Response): Promise<OllamaGenerateResponse> {
  return (await response.json()) as OllamaGenerateResponse;
}

export class OllamaScoreProvider implements ScoreProvider {
  readonly name = "ollama";

  constructor(
    private readonly options: {
      baseUrl: AppEnv["JOBGRINDER_OLLAMA_BASE_URL"];
      model: AppEnv["JOBGRINDER_OLLAMA_MODEL"];
      timeoutMs: AppEnv["JOBGRINDER_OLLAMA_TIMEOUT_MS"];
    },
  ) {}

  async score(job: ScoringJobRecord, profile: Profile): Promise<ProviderScore> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);

    try {
      const prompt = buildOllamaPrompt(job, profile);
      const firstAttempt = await this.callGenerate(prompt, controller.signal);

      try {
        return parseOllamaResponseText(firstAttempt.response ?? "");
      } catch {
        const retryPrompt = `${prompt}\nRespond again with valid JSON only. Do not include markdown fences or commentary.`;
        const secondAttempt = await this.callGenerate(retryPrompt, controller.signal);
        return parseOllamaResponseText(secondAttempt.response ?? "");
      }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error(
          `Ollama request timed out after ${this.options.timeoutMs}ms for model ${this.options.model}.`,
        );
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async callGenerate(prompt: string, signal: AbortSignal): Promise<OllamaGenerateResponse> {
    let response: Response;

    try {
      response = await fetch(new URL("/api/generate", this.options.baseUrl), {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          model: this.options.model,
          prompt,
          stream: false,
          options: {
            temperature: 0,
          },
        }),
        signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw error;
      }

      throw new Error(
        `Could not reach Ollama at ${this.options.baseUrl}. Make sure Ollama is running locally.`,
        { cause: error },
      );
    }

    const payload = await readResponseJson(response);
    if (!response.ok) {
      const detail = payload.error ?? `HTTP ${response.status}`;
      throw new Error(`Ollama request failed for model ${this.options.model}: ${detail}`);
    }

    if (payload.error) {
      throw new Error(`Ollama request failed for model ${this.options.model}: ${payload.error}`);
    }

    if (!payload.response) {
      throw new Error(`Ollama returned an empty response for model ${this.options.model}.`);
    }

    return payload;
  }
}
