import { requireAuth } from "~/lib/auth/session/server.server";
import { getCarWording } from "~/lib/services/reference.service";

import type { Route } from "./+types/car-wording";

/** GET /api/car-wording — claims wording catalogue for policy wizard. */
export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const carWording = await getCarWording();
  return Response.json(carWording);
}
