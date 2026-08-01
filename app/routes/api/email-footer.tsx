import { requireAuth } from "~/lib/auth/session.server";
import { isSuperAdmin } from "~/lib/auth/roles";
import {
  dataUriToBytes,
  getEmailFooterImage,
  restoreDefaultEmailFooterImage,
  saveEmailFooterDisplayWidth,
  saveEmailFooterFile,
} from "~/lib/services/email/footer-image.server";
import type { Route } from "./+types/email-footer";

/** GET — footer image bytes (or JSON meta with ?format=meta / data-uri). */
export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const footer = await getEmailFooterImage();

  if (url.searchParams.get("format") === "meta") {
    return Response.json({
      dataUri: footer.dataUri,
      displayWidth: footer.displayWidth,
    });
  }

  if (url.searchParams.get("format") === "data-uri") {
    return Response.json({
      dataUri: footer.dataUri,
      displayWidth: footer.displayWidth,
    });
  }

  const { contentType, bytes } = dataUriToBytes(footer.dataUri);
  return new Response(bytes.buffer as ArrayBuffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=60",
      "X-Footer-Display-Width": String(footer.displayWidth),
    },
  });
}

/**
 * POST multipart file — upload.
 * POST intent=width — save display width.
 * DELETE — restore default blob.
 */
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
    const footer = await getEmailFooterImage();
    return Response.json({
      ok: true,
      restored: true,
      dataUri,
      displayWidth: footer.displayWidth,
    });
  }

  if (request.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "upload");

  if (intent === "width") {
    const raw = Number(formData.get("displayWidth"));
    if (!Number.isFinite(raw)) {
      return Response.json({ error: "Enter a valid width." }, { status: 400 });
    }
    try {
      const displayWidth = await saveEmailFooterDisplayWidth(raw, viewer.email);
      return Response.json({ ok: true, displayWidth });
    } catch (error) {
      return Response.json(
        {
          error:
            error instanceof Error ? error.message : "Could not save width.",
        },
        { status: 400 },
      );
    }
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "Choose an image file." }, { status: 400 });
  }

  try {
    const dataUri = await saveEmailFooterFile(file, viewer.email);
    const footer = await getEmailFooterImage();
    return Response.json({
      ok: true,
      dataUri,
      displayWidth: footer.displayWidth,
    });
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
