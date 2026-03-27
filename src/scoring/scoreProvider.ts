import { z } from "zod";
import type { NormalizedJobRecord } from "../types/job.js";
import type { Profile } from "../types/profile.js";

export const providerFilterSchema = z.object({
  keep: z.boolean(),
  rationale: z.string().min(1),
  redFlags: z.array(z.string()),
});

export type ProviderFilter = z.infer<typeof providerFilterSchema>;

export interface ScoreProvider {
  readonly name: string;
  score(job: NormalizedJobRecord, profile: Profile): Promise<ProviderFilter>;
}
