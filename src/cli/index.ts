#!/usr/bin/env node
import { createContext } from "./context.js";
import { runAll, runExport, runNormalize, runReport, runScore } from "./pipeline.js";

type Command = "run" | "export" | "normalize" | "score" | "report";

async function main(): Promise<void> {
  const command = (process.argv[2] ?? "run") as Command;
  const context = await createContext();

  switch (command) {
    case "run": {
      const result = await runAll(context);
      context.logger.info("Run complete", result);
      return;
    }
    case "export": {
      const csvPath = await runExport(context);
      context.logger.info("Export complete", { csvPath });
      return;
    }
    case "normalize": {
      const result = await runNormalize(context, process.argv[3]);
      context.logger.info("Normalize complete", { outputPath: result.outputPath, jobs: result.normalizedJobs.length });
      return;
    }
    case "score": {
      const result = await runScore(context, process.argv[3]);
      context.logger.info("Score complete", { outputPath: result.outputPath, jobs: result.scoredJobs.length });
      printHints();
      return;
    }
    case "report": {
      const result = await runReport(context, process.argv[3]);
      context.logger.info("Report complete", { reportPath: result.reportPath, jobs: result.scoredJobs.length });
      return;
    }
    default:
      throw new Error(`Unknown command: ${command}`);
  }
}

function printHints(): void {
  console.log("");
  console.log("Run `npm run dev -- report` to regenerate the markdown report from the latest scored jobs.");
  console.log("Use `npm run dev -- normalize` to inspect the Airtable-shaped subset before scoring.");
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
