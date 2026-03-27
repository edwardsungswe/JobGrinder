import type { FilteredJobRecord } from "../types/job.js";

export function printSummary(scoredJobs: FilteredJobRecord[]): void {
  const topJobs = scoredJobs.filter((job) => job.keep);

  console.log("");
  console.log("Jobs worth applying to:");
  if (topJobs.length === 0) {
    console.log("- No jobs worth applying to.");
    return;
  }

  for (const job of topJobs) {
    console.log(`- ${job["Position Title"]} at ${job.Company}${job.Apply ? ` - ${job.Apply}` : ""}`);
  }
}
