import path from "node:path";
import { listFilesNewestFirst } from "../utils/fs.js";

export async function findLatestCsv(rawDir: string): Promise<string> {
  const files = await listFilesNewestFirst(rawDir);
  const csv = files.find((filePath) => path.extname(filePath).toLowerCase() === ".csv");

  if (!csv) {
    throw new Error(`No CSV files found in ${rawDir}`);
  }

  return csv;
}
