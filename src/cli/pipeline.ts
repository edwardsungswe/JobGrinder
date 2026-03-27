import { readFile } from "node:fs/promises";
import { exportAirtableCsv } from "../browser/exportAirtableCsv.js";
import { findLatestCsv } from "../ingest/latestCsv.js";
import { findLatestProcessedFile } from "../ingest/latestProcessedFile.js";
import { normalizeJobs } from "../ingest/normalizeJobs.js";
import { parseCsvFile } from "../ingest/parseCsv.js";
import { saveNormalizedJobs } from "../ingest/saveNormalizedJobs.js";
import { generateReport } from "../reporting/generateReport.js";
import { printSummary } from "../reporting/printSummary.js";
import { OllamaScoreProvider } from "../scoring/ollamaScoreProvider.js";
import { scoreJobs } from "../scoring/scoreJobs.js";
import { filteredJobRecordSchema, normalizedJobRecordSchema, type FilteredJobRecord, type NormalizedJobRecord } from "../types/job.js";
import { localDateStamp } from "../utils/date.js";

export async function runExport(context: Awaited<ReturnType<typeof import("./context.js").createContext>>): Promise<string> {
  return exportAirtableCsv({
    cwd: context.cwd,
    env: context.env,
    logger: context.logger,
  });
}

export async function runNormalize(
  context: Awaited<ReturnType<typeof import("./context.js").createContext>>,
  filePath?: string,
): Promise<{ normalizedJobs: NormalizedJobRecord[]; outputPath: string; sourcePath: string }> {
  const sourcePath = filePath ?? (await findLatestCsv(context.rawDir));
  const rows = await parseCsvFile(sourcePath);
  const allNormalizedJobs = normalizeJobs(rows);
  const normalizedJobs = allNormalizedJobs.slice(0, context.env.JOBGRINDER_RECENT_JOB_LIMIT);
  const outputPath = await saveNormalizedJobs(context.processedDir, normalizedJobs);

  context.logger.info("Normalized jobs", {
    sourcePath,
    inputCount: allNormalizedJobs.length,
    outputCount: normalizedJobs.length,
    limit: context.env.JOBGRINDER_RECENT_JOB_LIMIT,
    outputPath,
  });

  return { normalizedJobs, outputPath, sourcePath };
}

export async function runScore(
  context: Awaited<ReturnType<typeof import("./context.js").createContext>>,
  filePath?: string,
): Promise<{ scoredJobs: FilteredJobRecord[]; outputPath: string; sourcePath: string }> {
  const sourcePath = filePath ?? (await findLatestProcessedFile(context.processedDir, "-normalized-jobs.json"));
  const raw = await readFile(sourcePath, "utf8");
  const normalizedJobs = normalizedJobRecordSchema.array().parse(JSON.parse(raw));
  const provider = new OllamaScoreProvider({
    baseUrl: context.env.JOBGRINDER_OLLAMA_BASE_URL,
    model: context.env.JOBGRINDER_OLLAMA_MODEL,
    timeoutMs: context.env.JOBGRINDER_OLLAMA_TIMEOUT_MS,
  });

  context.logger.info("Scoring jobs", {
    sourcePath,
    jobCount: normalizedJobs.length,
    provider: provider.name,
    baseUrl: context.env.JOBGRINDER_OLLAMA_BASE_URL,
    model: context.env.JOBGRINDER_OLLAMA_MODEL,
  });

  const result = await scoreJobs({
    jobs: normalizedJobs,
    profile: context.profile,
    provider,
    processedDir: context.processedDir,
    logger: context.logger,
  });

  return { ...result, sourcePath };
}

export async function runReport(
  context: Awaited<ReturnType<typeof import("./context.js").createContext>>,
  scoredPath?: string,
): Promise<{ reportPath: string; markdown: string; scoredJobs: FilteredJobRecord[] }> {
  const sourcePath = scoredPath ?? `${context.processedDir}/${localDateStamp()}-filtered-jobs.json`;
  const raw = await readFile(sourcePath, "utf8");
  const scoredJobs = filteredJobRecordSchema.array().parse(JSON.parse(raw));
  const report = await generateReport({
    scoredJobs,
    outputDir: context.outputDir,
  });
  printSummary(scoredJobs);
  return { ...report, scoredJobs };
}

export async function runAll(
  context: Awaited<ReturnType<typeof import("./context.js").createContext>>,
): Promise<{ csvPath: string; normalizedPath: string; scoredPath: string; reportPath: string }> {
  const csvPath = await runExport(context);
  const { outputPath: normalizedPath } = await runNormalize(context, csvPath);
  const { outputPath: scoredPath, scoredJobs } = await runScore(context, normalizedPath);
  const { reportPath } = await generateReport({
    scoredJobs,
    outputDir: context.outputDir,
  });
  printSummary(scoredJobs);
  return { csvPath, normalizedPath, scoredPath, reportPath };
}
