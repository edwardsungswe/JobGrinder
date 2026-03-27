import path from "node:path";
import { loadAppEnv } from "../config/loadAppEnv.js";
import { loadProfile } from "../config/loadProfile.js";
import { Logger } from "../utils/logger.js";

export async function createContext(cwd = process.cwd()) {
  const env = loadAppEnv(cwd);
  const profile = await loadProfile(cwd);
  const logger = new Logger(env.JOBGRINDER_LOG_LEVEL);

  return {
    cwd,
    env,
    profile,
    logger,
    rawDir: path.join(cwd, "data", "raw"),
    processedDir: path.join(cwd, "data", "processed"),
    outputDir: path.resolve(cwd, env.JOBGRINDER_OUTPUT_DIR),
  };
}
