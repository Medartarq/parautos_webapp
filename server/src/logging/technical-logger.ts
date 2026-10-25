import pino, { type DestinationStream } from "pino";

const levels = new Set(["fatal", "error", "warn", "info", "debug", "trace", "silent"]);
const errorTypes = new Set(["Error", "TypeError", "RangeError", "SyntaxError", "ReferenceError", "AggregateError"]);

// Only explicit technical fields enter this logger. Never serialize raw requests,
// errors, SQL, headers, filenames or environment configuration.
export function createTechnicalLogger(destination?: DestinationStream) {
  const configuredLevel = process.env.LOG_LEVEL;
  const logger = pino({
    level: destination ? "trace" : configuredLevel && levels.has(configuredLevel) ? configuredLevel : process.env.NODE_ENV === "test" ? "silent" : "info",
    base: { service: "parautos" },
    timestamp: pino.stdTimeFunctions.isoTime,
    redact: { paths: ["password", "token", "cookie", "authorization", "email", "documentNumber", "phone", "req", "res", "sql", "sqlMessage", "stack"], remove: true },
  }, destination);
  return {
    requestCompleted(input: { requestId: string; method: string; statusCode: number; durationMs: number }) {
      logger.info({ event: "request_completed", requestId: input.requestId,
        method: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"].includes(input.method) ? input.method : "OTHER",
        statusCode: input.statusCode, durationMs: Math.round(input.durationMs * 100) / 100 });
    },
    failure(event: "request_failed" | "startup_failed" | "database_task_failed" | "database_connection_release_failed" | "database_connection_destroy_failed", error: unknown, requestId?: string) {
      const type = error instanceof Error && errorTypes.has(error.name) ? error.name : "Error";
      const errno = error && typeof error === "object" && "errno" in error && typeof error.errno === "number" && Number.isSafeInteger(error.errno) ? error.errno : undefined;
      logger.error({ event, requestId, errorType: type, errno });
    },
    started(port: number) { logger.info({ event: "server_started", port }); },
  };
}

export const technicalLogger = createTechnicalLogger();
