import type { NormalizedJobRecord } from "../types/job.js";
import type { Profile } from "../types/profile.js";
import { providerFilterSchema, type ProviderFilter, type ScoreProvider } from "./scoreProvider.js";

function countMatches(text: string, values: string[]): string[] {
  const lowered = text.toLowerCase();
  return values.filter((value) => lowered.includes(value.toLowerCase()));
}

export class MockScoreProvider implements ScoreProvider {
  readonly name = "mock";

  async score(job: NormalizedJobRecord, profile: Profile): Promise<ProviderFilter> {
    const haystack = [
      job["Position Title"],
      job.Qualifications,
      job.Location,
      job["Work Model"],
      job.Company,
    ].join(" ");
    const titleMatches = countMatches(job["Position Title"], profile.targetTitles);
    const keywordMatches = countMatches(haystack, profile.includeKeywords);
    const penalties = countMatches(haystack, profile.excludeKeywords);
    const keep = titleMatches.length > 0 || (keywordMatches.length > 0 && penalties.length === 0);

    return providerFilterSchema.parse({
      keep,
      rationale: keep
        ? "Job appears aligned with target title or preferred keywords."
        : "Job does not appear aligned enough to keep.",
      redFlags: penalties,
    });
  }
}
