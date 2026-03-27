import { writeFile } from "node:fs/promises";
import path from "node:path";
import type { ScoredJobRecord } from "../types/job.js";
import { localDateStamp } from "../utils/date.js";
import { ensureDir } from "../utils/fs.js";

function renderJob(job: ScoredJobRecord): string {
  const lines = [
    `- **${job.score}** | ${job.title} at ${job.company}`,
    `  Recommendation: ${job.recommendation}`,
    `  Why: ${job.rationale}`,
  ];

  if (job.url) {
    lines.push(`  Link: ${job.url}`);
  }

  if (job.redFlags.length > 0) {
    lines.push(`  Red flags: ${job.redFlags.join(", ")}`);
  }

  return lines.join("\n");
}

export async function generateReport(params: {
  scoredJobs: ScoredJobRecord[];
  outputDir: string;
}): Promise<{ reportPath: string; markdown: string }> {
  const yesJobs = params.scoredJobs.filter((job) => job.recommendation === "yes");
  const maybeJobs = params.scoredJobs.filter((job) => job.recommendation === "maybe");
  const noJobs = params.scoredJobs.filter((job) => job.recommendation === "no");

  const markdown = [
    `# JobGrinder Report - ${localDateStamp()}`,
    "",
    `Top jobs to apply to now: ${yesJobs.length}`,
    "",
    "## Apply Now",
    yesJobs.length > 0 ? yesJobs.map(renderJob).join("\n\n") : "- No strong matches today.",
    "",
    "## Maybe Later",
    maybeJobs.length > 0 ? maybeJobs.map(renderJob).join("\n\n") : "- No maybe jobs.",
    "",
    "## Rejected",
    noJobs.length > 0 ? noJobs.map(renderJob).join("\n\n") : "- No rejected jobs.",
    "",
  ].join("\n");

  await ensureDir(params.outputDir);
  const reportPath = path.join(params.outputDir, `${localDateStamp()}-report.md`);
  await writeFile(reportPath, markdown, "utf8");

  return { reportPath, markdown };
}
