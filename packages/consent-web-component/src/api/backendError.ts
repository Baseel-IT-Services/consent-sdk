/**
 * The backend owns error wording: its error bodies carry a human-readable `message`
 * ({ timestamp, status, error, message }), which the widget shows as-is.
 */
export function backendMessage(body: unknown): string {
  if (!body || typeof body !== 'object') return '';
  const { message } = body as { message?: unknown };
  return typeof message === 'string' ? message.trim() : '';
}

/** Reads the backend error message from a failed response, or '' when the body has none. */
export async function readBackendMessage(response: Response): Promise<string> {
  const body = await response.json().catch(() => ({}));
  return backendMessage(body);
}
