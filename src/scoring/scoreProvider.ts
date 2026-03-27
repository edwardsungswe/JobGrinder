import { z } from "zod";
import type { ScoringJobRecord } from "../types/job.js";
import type { Profile } from "../types/profile.js";

export const providerScoreSchema = z.object({
  score: z.number().min(0).max(100),
  rationale: z.string().min(1),
  matchingFactors: z.array(z.string()),
  redFlags: z.array(z.string()),
  recommendation: z.enum(["yes", "maybe", "no"]),
});

export type ProviderScore = z.infer<typeof providerScoreSchema>;

export interface ScoreProvider {
  readonly name: string;
  score(job: ScoringJobRecord, profile: Profile): Promise<ProviderScore>;
}
