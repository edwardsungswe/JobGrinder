type LogLevel = "debug" | "info" | "warn" | "error";

const priority: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export class Logger {
  constructor(private readonly level: LogLevel = "info") {}

  debug(message: string, details?: unknown): void {
    this.log("debug", message, details);
  }

  info(message: string, details?: unknown): void {
    this.log("info", message, details);
  }

  warn(message: string, details?: unknown): void {
    this.log("warn", message, details);
  }

  error(message: string, details?: unknown): void {
    this.log("error", message, details);
  }

  private log(level: LogLevel, message: string, details?: unknown): void {
    if (priority[level] < priority[this.level]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const suffix = details === undefined ? "" : ` ${JSON.stringify(details)}`;
    console.log(`[${timestamp}] [${level.toUpperCase()}] ${message}${suffix}`);
  }
}
