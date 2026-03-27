import path from "node:path";
import dotenv from "dotenv";
import { appEnvSchema, type AppEnv } from "../types/config.js";

export function loadAppEnv(cwd: string): AppEnv {
  dotenv.config({ path: path.join(cwd, ".env") });

  return appEnvSchema.parse({
    JOBGRINDER_AIRTABLE_URL: process.env.JOBGRINDER_AIRTABLE_URL,
    JOBGRINDER_OLLAMA_BASE_URL: process.env.JOBGRINDER_OLLAMA_BASE_URL,
    JOBGRINDER_OLLAMA_MODEL: process.env.JOBGRINDER_OLLAMA_MODEL,
    JOBGRINDER_OLLAMA_TIMEOUT_MS: process.env.JOBGRINDER_OLLAMA_TIMEOUT_MS,
    JOBGRINDER_RECENT_JOB_LIMIT: process.env.JOBGRINDER_RECENT_JOB_LIMIT,
    JOBGRINDER_DOWNLOAD_DIR: process.env.JOBGRINDER_DOWNLOAD_DIR,
    JOBGRINDER_PLAYWRIGHT_PROFILE: process.env.JOBGRINDER_PLAYWRIGHT_PROFILE,
    JOBGRINDER_HEADLESS: process.env.JOBGRINDER_HEADLESS,
    JOBGRINDER_OUTPUT_DIR: process.env.JOBGRINDER_OUTPUT_DIR,
    JOBGRINDER_LOG_LEVEL: process.env.JOBGRINDER_LOG_LEVEL,
  });
}
