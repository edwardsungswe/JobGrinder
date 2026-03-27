import { writeFile } from "node:fs/promises";
import path from "node:path";
import { normalizedJobRecordSchema, type NormalizedJobRecord } from "../types/job.js";
import { localDateStamp } from "../utils/date.js";
import { ensureDir } from "../utils/fs.js";

function parsePostedAt(value?: string): number {
  if (!value) {
    return Number.NEGATIVE_INFINITY;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

export function filterRecentJobs(jobs: NormalizedJobRecord[], limit: number): NormalizedJobRecord[] {
  return [...jobs]
    .sort((left, right) => parsePostedAt(right.Date) - parsePostedAt(left.Date))
    .slice(0, limit)
    .map((job) => normalizedJobRecordSchema.parse(job));
}

export async function saveRecentJobs(processedDir: string, jobs: NormalizedJobRecord[]): Promise<string> {
  await ensureDir(processedDir);
  const outputPath = path.join(processedDir, `${localDateStamp()}-recent-jobs.json`);
  await writeFile(outputPath, JSON.stringify(jobs, null, 2));
  return outputPath;
}
