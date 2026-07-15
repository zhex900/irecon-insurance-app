/** Chrome DevTools probes this URL automatically — not an app route. */
export function loader() {
  return Response.json({});
}
