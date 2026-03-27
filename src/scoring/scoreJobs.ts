import { writeFile } from "node:fs/promises";
import path from "node:path";
import { filteredJobRecordSchema, type FilteredJobRecord, type NormalizedJobRecord } from "../types/job.js";
import { localDateStamp } from "../utils/date.js";
import type { Profile } from "../types/profile.js";
import { ensureDir } from "../utils/fs.js";
import type { Logger } from "../utils/logger.js";
import { toScoringJobRecord } from "../ingest/normalizeJobs.js";
import { prefilterJob } from "./prefilter.js";
import type { ScoreProvider } from "./scoreProvider.js";

export async function scoreJobs(params: {
  jobs: NormalizedJobRecord[];
  profile: Profile;
  provider: ScoreProvider;
  processedDir: string;
  logger: Logger;
}): Promise<{ scoredJobs: FilteredJobRecord[]; outputPath: string }> {
  const scoredJobs: FilteredJobRecord[] = [];

  for (const [index, job] of params.jobs.entries()) {
    const scoringJob = toScoringJobRecord(job, index + 1);
    const prefilter = prefilterJob(scoringJob, params.profile);
    if (prefilter.decision === "yes" || prefilter.decision === "no") {
      scoredJobs.push(
        filteredJobRecordSchema.parse({
          ...job,
          keep: prefilter.decision === "yes",
          rationale: prefilter.reasons.join("; "),
          redFlags: prefilter.decision === "no" ? prefilter.reasons : [],
          deterministicDecision: prefilter.decision,
          deterministicReasons: prefilter.reasons,
          provider: "deterministic",
        }),
      );
      continue;
    }

    const providerScore = await params.provider.score(job, params.profile);
    scoredJobs.push(
      filteredJobRecordSchema.parse({
        ...job,
        keep: providerScore.keep,
        rationale: providerScore.rationale,
        redFlags: providerScore.redFlags,
        deterministicDecision: prefilter.decision,
        deterministicReasons: prefilter.reasons,
        provider: params.provider.name,
      }),
    );
  }

  await ensureDir(params.processedDir);
  const outputPath = path.join(params.processedDir, `${localDateStamp()}-filtered-jobs.json`);
  await writeFile(outputPath, JSON.stringify(scoredJobs, null, 2));
  return { scoredJobs, outputPath };
}
