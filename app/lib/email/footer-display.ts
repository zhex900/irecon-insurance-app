/** Default / clamp for footer logo width in email HTML. */
export const EMAIL_FOOTER_DISPLAY_WIDTH_DEFAULT = 520;
export const EMAIL_FOOTER_DISPLAY_WIDTH_MIN = 240;
export const EMAIL_FOOTER_DISPLAY_WIDTH_MAX = 720;
export const EMAIL_FOOTER_DISPLAY_WIDTH_STEP = 40;

export function clampEmailFooterDisplayWidth(widthPx: number): number {
  const n = Math.round(Number(widthPx));
  if (!Number.isFinite(n)) return EMAIL_FOOTER_DISPLAY_WIDTH_DEFAULT;
  return Math.min(
    EMAIL_FOOTER_DISPLAY_WIDTH_MAX,
    Math.max(EMAIL_FOOTER_DISPLAY_WIDTH_MIN, n),
  );
}
