import type { ScoredJobRecord } from "../types/job.js";

export function printSummary(scoredJobs: ScoredJobRecord[]): void {
  const topJobs = scoredJobs.filter((job) => job.recommendation === "yes").slice(0, 10);

  console.log("");
  console.log("Top jobs to apply to:");
  if (topJobs.length === 0) {
    console.log("- No strong matches today.");
    return;
  }

  for (const job of topJobs) {
    console.log(`- [${job.score}] ${job.title} at ${job.company}${job.url ? ` - ${job.url}` : ""}`);
  }
}
