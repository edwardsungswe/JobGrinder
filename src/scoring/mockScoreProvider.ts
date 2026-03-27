import type { ScoringJobRecord } from "../types/job.js";
import type { Profile } from "../types/profile.js";
import { providerScoreSchema, type ProviderScore, type ScoreProvider } from "./scoreProvider.js";

function countMatches(text: string, values: string[]): string[] {
  const lowered = text.toLowerCase();
  return values.filter((value) => lowered.includes(value.toLowerCase()));
}

export class MockScoreProvider implements ScoreProvider {
  readonly name = "mock";

  async score(job: ScoringJobRecord, profile: Profile): Promise<ProviderScore> {
    const haystack = [job.title, job.description, job.location, job.seniority, job.employmentType].join(" ");
    const titleMatches = countMatches(job.title, profile.targetTitles);
    const keywordMatches = countMatches(haystack, profile.includeKeywords);
    const penalties = countMatches(haystack, profile.excludeKeywords);
    const rawScore = 45 + titleMatches.length * 15 + keywordMatches.length * 8 - penalties.length * 20;
    const score = Math.max(0, Math.min(100, rawScore));

    return providerScoreSchema.parse({
      score,
      rationale:
        score >= 75
          ? "Strong profile overlap based on target title and preferred keywords."
          : "Moderate overlap. Review manually before applying.",
      matchingFactors: [...titleMatches, ...keywordMatches].slice(0, 5),
      redFlags: penalties,
      recommendation: score >= 75 ? "yes" : score >= 55 ? "maybe" : "no",
    });
  }
}
