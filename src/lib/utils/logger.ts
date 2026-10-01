import "server-only";

type Level = "debug" | "info" | "warn" | "error";
const ORDER: Record<Level, number> = { debug: 10, info: 20, warn: 30, error: 40 };

/** Keys that must never reach the logs, wherever they appear in a log payload. */
const REDACT = /token|secret|password|authorization|cookie|api[-_]?key/i;

function redact(value: unknown, depth = 0): unknown {
  if (depth > 4 || value === null || typeof value !== "object") return value;
  if (value instanceof Error) return { name: value.name, message: value.message, stack: value.stack };
  if (Array.isArray(value)) return value.map((v) => redact(v, depth + 1));
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, REDACT.test(k) ? "[redacted]" : redact(v, depth + 1)]),
  );
}

function currentLevel(): Level {
  const level = process.env.LOG_LEVEL as Level | undefined;
  return level && level in ORDER ? level : "info";
}

function write(level: Level, scope: string, message: string, data?: Record<string, unknown>) {
  if (ORDER[level] < ORDER[currentLevel()]) return;
  const payload = data ? (redact(data) as Record<string, unknown>) : undefined;
  if (process.env.NODE_ENV === "production") {
    // One JSON object per line — friendly to log aggregators.
    console[level === "debug" ? "log" : level](
      JSON.stringify({ time: new Date().toISOString(), level, scope, message, ...payload }),
    );
  } else {
    const line = `[${scope}] ${message}`;
    if (payload) console[level === "debug" ? "log" : level](line, payload);
    else console[level === "debug" ? "log" : level](line);
  }
}

export type Logger = ReturnType<typeof createLogger>;

export function createLogger(scope: string) {
  return {
    debug: (message: string, data?: Record<string, unknown>) => write("debug", scope, message, data),
    info: (message: string, data?: Record<string, unknown>) => write("info", scope, message, data),
    warn: (message: string, data?: Record<string, unknown>) => write("warn", scope, message, data),
    error: (message: string, data?: Record<string, unknown>) => write("error", scope, message, data),
  };
}
