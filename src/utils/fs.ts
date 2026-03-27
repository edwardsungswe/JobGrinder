import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
}

export async function listFilesNewestFirst(dirPath: string): Promise<string[]> {
  const entries = await readdir(dirPath, { withFileTypes: true });
  const files = await Promise.all(
    entries
      .filter((entry) => entry.isFile())
      .map(async (entry) => {
        const absolutePath = path.join(dirPath, entry.name);
        const stats = await import("node:fs/promises").then((fs) => fs.stat(absolutePath));
        return { absolutePath, modifiedAt: stats.mtimeMs };
      }),
  );

  return files
    .sort((left, right) => right.modifiedAt - left.modifiedAt)
    .map((file) => file.absolutePath);
}
