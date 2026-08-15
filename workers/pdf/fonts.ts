import { getDefaultFont, type Font } from "@pdfme/common";

export type DocumentAssetBinding = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

const FONT_FILES = {
  "Roboto Bold": "Roboto-Bold.ttf",
  "Roboto Italic": "Roboto-Italic.ttf",
  "Roboto Bold Italic": "Roboto-BoldItalic.ttf",
  "Times New Roman": "Tinos-Regular.ttf",
  "Times New Roman Bold": "Tinos-Bold.ttf",
  "Times New Roman Italic": "Tinos-Italic.ttf",
  "Times New Roman Bold Italic": "Tinos-BoldItalic.ttf",
} as const;

async function loadFont(assets: DocumentAssetBinding, filename: string) {
  const response = await assets.fetch(`https://document-assets/${filename}`);
  if (!response.ok)
    throw new Error(`Document font is unavailable: ${filename}`);
  return response.arrayBuffer();
}

/** Load immutable font assets only for render requests. */
export async function getDocumentWorkerFonts(
  assets: DocumentAssetBinding,
): Promise<Font> {
  const entries = await Promise.all(
    Object.entries(FONT_FILES).map(async ([name, filename]) => [
      name,
      { data: await loadFont(assets, filename) },
    ]),
  );
  const defaults = getDefaultFont();
  return {
    Roboto: { data: defaults.Roboto.data, fallback: true },
    ...Object.fromEntries(entries),
  };
}
