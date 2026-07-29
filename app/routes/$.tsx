import type { Route } from "./+types/$";
import { pageTitle } from "~/lib/brand";

export function meta() {
  return [{ title: pageTitle("Not found") }];
}

/** Catch-all — unknown URLs render the root ErrorBoundary as 404. */
export async function loader({ request }: Route.LoaderArgs) {
  throw new Response(`No route matches ${new URL(request.url).pathname}`, {
    status: 404,
    statusText: "Not Found",
  });
}

export default function CatchAllRoute() {
  return null;
}
