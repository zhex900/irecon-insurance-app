// Document worker font management service
import { getDefaultFont, type Font } from "@pdfme/common";
import { FONT_FILES } from "../constants";

export type DocumentAssetBinding = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

/**
 * Load a single font file from assets
 */
async function loadFont(
  assets: DocumentAssetBinding,
  filename: string,
): Promise<ArrayBuffer> {
  const response = await assets.fetch(`https://document-assets/${filename}`);

  if (!response.ok) {
    throw new Error(`Document font is unavailable: ${filename}`);
  }

  return response.arrayBuffer();
}

/**
 * Load immutable font assets only for render requests
 */
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
