import { z } from "zod";

const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

const siteverifyResponseSchema = z.object({
  success: z.boolean(),
  "error-codes": z.array(z.string()).optional(),
});

export type TurnstileVerifyResult = {
  success: boolean;
  errorCodes: string[];
};

export async function verifyTurnstileToken(
  token: string,
  secretKey: string,
  remoteIp?: string,
): Promise<TurnstileVerifyResult> {
  const body = new URLSearchParams({
    secret: secretKey,
    response: token,
  });
  if (remoteIp) body.set("remoteip", remoteIp);

  const response = await fetch(SITEVERIFY_URL, {
    method: "POST",
    body,
  });

  if (!response.ok) {
    return { success: false, errorCodes: ["siteverify-http-error"] };
  }

  const json: unknown = await response.json();
  const parsed = siteverifyResponseSchema.safeParse(json);
  if (!parsed.success) {
    return { success: false, errorCodes: ["siteverify-invalid-response"] };
  }

  return {
    success: parsed.data.success,
    errorCodes: parsed.data["error-codes"] ?? [],
  };
}

/** Prefer Cloudflare `CF-Connecting-IP`, then first `X-Forwarded-For` entry. */
export function clientIpFromRequest(request: Request): string | undefined {
  const cf = request.headers.get("CF-Connecting-IP")?.trim();
  if (cf) return cf;
  const forwarded = request.headers.get("X-Forwarded-For");
  if (!forwarded) return undefined;
  const first = forwarded.split(",")[0]?.trim();
  return first || undefined;
}
