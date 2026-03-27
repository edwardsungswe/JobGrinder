import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { FilteredJobRecord } from "../types/job.js";
import { localDateStamp } from "../utils/date.js";
import { ensureDir } from "../utils/fs.js";

function renderJob(job: FilteredJobRecord): string {
  const lines = [
    `- ${job["Position Title"]} at ${job.Company}`,
    `  Why: ${job.rationale}`,
  ];

  if (job.Apply) {
    lines.push(`  Link: ${job.Apply}`);
  }

  if (job.redFlags.length > 0) {
    lines.push(`  Red flags: ${job.redFlags.join(", ")}`);
  }

  return lines.join("\n");
}

export async function generateReport(params: {
  scoredJobs: FilteredJobRecord[];
  outputDir: string;
}): Promise<{ reportPath: string; markdown: string }> {
  const keepJobs = params.scoredJobs.filter((job) => job.keep);
  const dropJobs = params.scoredJobs.filter((job) => !job.keep);

  const markdown = [
    `# JobGrinder Report - ${localDateStamp()}`,
    "",
    `Jobs worth applying to: ${keepJobs.length}`,
    "",
    "## Apply",
    keepJobs.length > 0 ? keepJobs.map(renderJob).join("\n\n") : "- No jobs worth applying to.",
    "",
    "## Filtered Out",
    dropJobs.length > 0 ? dropJobs.map(renderJob).join("\n\n") : "- No filtered jobs.",
    "",
  ].join("\n");

  await ensureDir(params.outputDir);
  const reportPath = path.join(params.outputDir, `${localDateStamp()}-report.md`);
  await writeFile(reportPath, markdown, "utf8");

  return { reportPath, markdown };
}
