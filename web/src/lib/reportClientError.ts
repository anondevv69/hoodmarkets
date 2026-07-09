import { API_BASE } from '../api';

/** Fire-and-forget: post unexpected client errors to the API (Discord debug channel when configured). */
export function reportClientError(
  surface: string,
  error: unknown,
  context?: Record<string, string>,
): void {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  void fetch(`${API_BASE}/api/report-client-error`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      surface,
      message: message.slice(0, 4000),
      stack: stack?.slice(0, 8000),
      context,
    }),
  }).catch(() => {
    /* best-effort */
  });
}
