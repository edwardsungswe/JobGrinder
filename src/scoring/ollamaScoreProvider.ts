import type { AppEnv } from "../types/config.js";
import type { NormalizedJobRecord } from "../types/job.js";
import type { Profile } from "../types/profile.js";
import { providerFilterSchema, type ProviderFilter, type ScoreProvider } from "./scoreProvider.js";

type OllamaGenerateResponse = {
  response?: string;
  error?: string;
  done?: boolean;
};

export function buildOllamaPrompt(job: NormalizedJobRecord, profile: Profile): string {
  return [
    "Decide whether this job is worth applying to for one candidate.",
    "Return JSON only.",
    'JSON keys: keep, rationale, redFlags.',
    "keep must be true or false.",
    "redFlags must be an array of short strings.",
    "Use the candidate profile as the source of truth for fit.",
    "Focus especially on company quality/reputation and whether the qualifications allow a master's student to apply.",
    "If the job appears undergraduate-only and does not look open to master's students, set keep to false.",
    "If pay is missing or below the preferred threshold, you may still set keep to true if the company is strong enough and the role still looks worth applying to.",
    "Do not rank jobs. Only decide whether to keep or drop this one job.",
    `Candidate profile: ${JSON.stringify(profile)}`,
    `Job: ${JSON.stringify(job)}`,
  ].join("\n");
}

export function parseOllamaResponseText(text: string): ProviderFilter {
  const trimmed = text.trim();
  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  const candidate = fencedMatch?.[1]?.trim() ?? trimmed;
  return providerFilterSchema.parse(JSON.parse(candidate));
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

  async score(job: NormalizedJobRecord, profile: Profile): Promise<ProviderFilter> {
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
