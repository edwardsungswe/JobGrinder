import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { NormalizedJobRecord } from "../types/job.js";
import { localDateStamp } from "../utils/date.js";
import { ensureDir } from "../utils/fs.js";

export async function saveNormalizedJobs(processedDir: string, jobs: NormalizedJobRecord[]): Promise<string> {
  await ensureDir(processedDir);
  const outputPath = path.join(processedDir, `${localDateStamp()}-normalized-jobs.json`);
  await writeFile(outputPath, JSON.stringify(jobs, null, 2));
  return outputPath;
}
