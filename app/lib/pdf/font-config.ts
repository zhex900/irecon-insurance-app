export const PDFME_FONT_FAMILIES = ["Roboto", "Times New Roman"] as const;
export type PdfmeFontFamily = (typeof PDFME_FONT_FAMILIES)[number];

export const PDFME_FONT_WEIGHTS = ["400", "700"] as const;
export type PdfmeFontWeight = (typeof PDFME_FONT_WEIGHTS)[number];

export const PDFME_FONT_WEIGHT_LABELS: Record<PdfmeFontWeight, string> = {
  "400": "Regular",
  "700": "Bold",
};

export const PDFME_FONT_STYLES = ["normal", "italic"] as const;
export type PdfmeFontStyle = (typeof PDFME_FONT_STYLES)[number];

export const PDFME_FONT_STYLE_LABELS: Record<PdfmeFontStyle, string> = {
  normal: "Normal",
  italic: "Italic",
};

type Typeface = {
  family: PdfmeFontFamily;
  weight: PdfmeFontWeight;
  style: PdfmeFontStyle;
};

/** Internal pdfme fontName keys; must match the registered font data. */
export function resolvePdfmeFontName(
  family: PdfmeFontFamily,
  weight: PdfmeFontWeight,
  style: PdfmeFontStyle = "normal",
): string {
  const bold = weight === "700";
  const italic = style === "italic";
  if (bold && italic) return `${family} Bold Italic`;
  if (bold) return `${family} Bold`;
  if (italic) return `${family} Italic`;
  return family;
}

export function parsePdfmeFontName(fontName?: string | null): Typeface {
  const name = (fontName ?? "").trim();
  if (name === "Bold") {
    return { family: "Roboto", weight: "700", style: "normal" };
  }

  const family: PdfmeFontFamily = name.startsWith("Times New Roman")
    ? "Times New Roman"
    : "Roboto";
  const weight: PdfmeFontWeight = /\bBold\b/.test(name) ? "700" : "400";
  const style: PdfmeFontStyle = /\bItalic\b/.test(name) ? "italic" : "normal";
  return { family, weight, style };
}

export function pdfmeFontVariantsForFamily(family: PdfmeFontFamily) {
  return {
    bold: resolvePdfmeFontName(family, "700"),
    italic: resolvePdfmeFontName(family, "400", "italic"),
    boldItalic: resolvePdfmeFontName(family, "700", "italic"),
  };
}
