/**
 * Error monitoring hook.
 *
 * Errors are written as structured JSON to the server log (visible in
 * Vercel → Project → Logs). To forward errors to a monitoring service such as
 * Sentry later, add the call inside `reportToProvider` — every error in the
 * app already flows through `logError`.
 */

type Context = Record<string, unknown>;

function serialize(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack?.split("\n").slice(0, 6).join("\n") };
  }
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    return { message: String(e.message ?? "unknown"), code: e.code, details: e.details, hint: e.hint };
  }
  return { message: String(error) };
}

function reportToProvider(_scope: string, _error: unknown, _context?: Context) {
  // Integration point for an external error tracker (e.g. Sentry.captureException).
}

export function logError(scope: string, error: unknown, context?: Context) {
  console.error(JSON.stringify({ level: "error", scope, error: serialize(error), ...context, at: new Date().toISOString() }));
  reportToProvider(scope, error, context);
}

export function logInfo(scope: string, message: string, context?: Context) {
  console.info(JSON.stringify({ level: "info", scope, message, ...context, at: new Date().toISOString() }));
}
