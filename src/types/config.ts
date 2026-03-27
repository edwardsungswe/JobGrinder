import { z } from "zod";

export const appEnvSchema = z.object({
  JOBGRINDER_AIRTABLE_URL: z.string().url(),
  JOBGRINDER_OLLAMA_BASE_URL: z.string().url().default("http://127.0.0.1:11434"),
  JOBGRINDER_OLLAMA_MODEL: z.string().min(1).default("qwen2.5:7b"),
  JOBGRINDER_OLLAMA_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  JOBGRINDER_RECENT_JOB_LIMIT: z.coerce.number().int().positive().default(50),
  JOBGRINDER_DOWNLOAD_DIR: z.string().min(1).default("./playwright-downloads"),
  JOBGRINDER_PLAYWRIGHT_PROFILE: z.string().min(1).default("./.playwright-profile"),
  JOBGRINDER_HEADLESS: z
    .string()
    .optional()
    .transform((value) => value === "true"),
  JOBGRINDER_OUTPUT_DIR: z.string().min(1).default("./output"),
  JOBGRINDER_LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),
});

export type AppEnv = z.infer<typeof appEnvSchema>;
