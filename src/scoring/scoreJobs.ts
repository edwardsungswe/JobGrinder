import { writeFile } from "node:fs/promises";
import path from "node:path";
import { scoredJobRecordSchema, type ScoredJobRecord, type ScoringJobRecord } from "../types/job.js";
import { localDateStamp } from "../utils/date.js";
import type { Profile } from "../types/profile.js";
import { ensureDir } from "../utils/fs.js";
import type { Logger } from "../utils/logger.js";
import { prefilterJob } from "./prefilter.js";
import type { ScoreProvider } from "./scoreProvider.js";

export async function scoreJobs(params: {
  jobs: ScoringJobRecord[];
  profile: Profile;
  provider: ScoreProvider;
  processedDir: string;
  logger: Logger;
}): Promise<{ scoredJobs: ScoredJobRecord[]; outputPath: string }> {
  const scoredJobs: ScoredJobRecord[] = [];

  for (const job of params.jobs) {
    const prefilter = prefilterJob(job, params.profile);
    const providerScore = await params.provider.score(job, params.profile);
    scoredJobs.push(
      scoredJobRecordSchema.parse({
        ...job,
        deterministicDecision: prefilter.decision,
        deterministicReasons: prefilter.reasons,
        ...providerScore,
        provider: params.provider.name,
      }),
    );
  }

  scoredJobs.sort((left, right) => right.score - left.score);

  await ensureDir(params.processedDir);
  const outputPath = path.join(params.processedDir, `${localDateStamp()}-scored-jobs.json`);
  await writeFile(outputPath, JSON.stringify(scoredJobs, null, 2));
  return { scoredJobs, outputPath };
}
