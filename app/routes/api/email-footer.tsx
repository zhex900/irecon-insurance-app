import { requireAuth } from "~/lib/auth/session.server";
import { isSuperAdmin } from "~/lib/auth/roles";
import {
  dataUriToBytes,
  getEmailFooterDataUri,
  restoreDefaultEmailFooterImage,
  saveEmailFooterFile,
} from "~/lib/services/email/footer-image";
import type { Route } from "./+types/email-footer";

/** GET — footer image bytes from the database (data URI stored as blob). */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const dataUri = await getEmailFooterDataUri();

  if (url.searchParams.get("format") === "data-uri") {
    return Response.json({ dataUri });
  }

  const { contentType, bytes } = dataUriToBytes(dataUri);
  return new Response(bytes.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=60",
    },
  });
}

/** POST multipart file — super-admin upload. DELETE — restore default blob. */
export async function action({ request }: Route.ActionArgs) {
  const viewer = await requireAuth(request);
  if (!isSuperAdmin(viewer)) {
    return Response.json(
      { error: "Only super-admins can change the email footer." },
      { status: 403 },
    );
  }

  if (request.method === "DELETE") {
    const dataUri = await restoreDefaultEmailFooterImage(viewer.email);
    return Response.json({ ok: true, restored: true, dataUri });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Choose an image file." }, { status: 400 });
  }

  try {
    const dataUri = await saveEmailFooterFile(file, viewer.email);
    return Response.json({ ok: true, dataUri });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Could not upload image.",
      },
      { status: 400 },
    );
  }
}
