import { readdir } from "node:fs/promises";
import path from "node:path";

export async function findLatestProcessedFile(processedDir: string, suffix: string): Promise<string> {
  const entries = await readdir(processedDir, { withFileTypes: true });
  const matches = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(suffix))
    .map((entry) => path.join(processedDir, entry.name))
    .sort()
    .reverse();
  const match = matches[0];

  if (!match) {
    throw new Error(`No processed file found with suffix ${suffix} in ${processedDir}`);
  }

  return match;
}
