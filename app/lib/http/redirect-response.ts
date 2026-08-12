/**
 * Framework-agnostic redirect `Response`, equivalent to react-router's
 * `redirect()` helper. Use this in `app/lib/services/**` — services must not
 * import `react-router` (see docs/architecture.md); React Router recognizes
 * any thrown `Response` with a `Location` header as a redirect, regardless of
 * which helper constructed it.
 */
export function redirectResponse(url: string, status = 302): Response {
  return new Response(null, { status, headers: { Location: url } });
}
