import { readFile } from "node:fs/promises";
import { parse } from "csv-parse/sync";
import { jobRecordSchema, type JobRecord } from "../types/job.js";

export async function parseCsvFile(filePath: string): Promise<JobRecord[]> {
  const fileContents = await readFile(filePath, "utf8");
  const rows = parse(fileContents, {
    columns: true,
    skip_empty_lines: true,
    bom: true,
    trim: true,
  }) as Array<Record<string, unknown>>;

  return rows.map((row, index) =>
    jobRecordSchema.parse({
      sourceRowNumber: index + 1,
      raw: Object.fromEntries(
        Object.entries(row).map(([key, value]) => [key, value === undefined || value === null ? "" : String(value)]),
      ),
    }),
  );
}
