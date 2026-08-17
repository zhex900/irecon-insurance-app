import { type Font,getDefaultFont } from "@pdfme/common";

import robotoBoldUrl from "~/assets/fonts/Roboto-Bold.ttf?url";
import robotoBoldItalicUrl from "~/assets/fonts/Roboto-BoldItalic.ttf?url";
import robotoItalicUrl from "~/assets/fonts/Roboto-Italic.ttf?url";
import tinosBoldUrl from "~/assets/fonts/Tinos-Bold.ttf?url";
import tinosBoldItalicUrl from "~/assets/fonts/Tinos-BoldItalic.ttf?url";
import tinosItalicUrl from "~/assets/fonts/Tinos-Italic.ttf?url";
import tinosRegularUrl from "~/assets/fonts/Tinos-Regular.ttf?url";

let fontsPromise: Promise<Font> | null = null;

async function loadFontBytes(
  absolutePath: string,
  urls: string[],
): Promise<ArrayBuffer> {
  if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const { readFile } = await import("node:fs/promises");
      const { join } = await import("node:path");
      const bytes = await readFile(join(process.cwd(), absolutePath));
      return bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      ) as ArrayBuffer;
    } catch {
      // Fall through to fetch.
    }
  }

  for (const url of urls) {
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      return await response.arrayBuffer();
    } catch {
      // try next
    }
  }

  throw new Error(`Failed to load font (${absolutePath}).`);
}

/**
 * Font faces for Designer + generator.
 * Typeface / weight / style are separate Designer controls that resolve to
 * these registered fontName keys.
 */
export function getPdfmeFonts(): Promise<Font> {
  if (!fontsPromise) {
    fontsPromise = (async (): Promise<Font> => {
      const defaults = getDefaultFont();
      const [
        robotoBold,
        robotoItalic,
        robotoBoldItalic,
        timesRegular,
        timesBold,
        timesItalic,
        timesBoldItalic,
      ] = await Promise.all([
        loadFontBytes("public/fonts/Roboto-Bold.ttf", [
          robotoBoldUrl,
          "/fonts/Roboto-Bold.ttf",
        ]),
        loadFontBytes("public/fonts/Roboto-Italic.ttf", [
          robotoItalicUrl,
          "/fonts/Roboto-Italic.ttf",
        ]),
        loadFontBytes("public/fonts/Roboto-BoldItalic.ttf", [
          robotoBoldItalicUrl,
          "/fonts/Roboto-BoldItalic.ttf",
        ]),
        loadFontBytes("public/fonts/Tinos-Regular.ttf", [
          tinosRegularUrl,
          "/fonts/Tinos-Regular.ttf",
        ]),
        loadFontBytes("public/fonts/Tinos-Bold.ttf", [
          tinosBoldUrl,
          "/fonts/Tinos-Bold.ttf",
        ]),
        loadFontBytes("public/fonts/Tinos-Italic.ttf", [
          tinosItalicUrl,
          "/fonts/Tinos-Italic.ttf",
        ]),
        loadFontBytes("public/fonts/Tinos-BoldItalic.ttf", [
          tinosBoldItalicUrl,
          "/fonts/Tinos-BoldItalic.ttf",
        ]),
      ]);

      return {
        Roboto: {
          data: defaults.Roboto.data,
          fallback: true,
        },
        "Roboto Bold": { data: robotoBold },
        "Roboto Italic": { data: robotoItalic },
        "Roboto Bold Italic": { data: robotoBoldItalic },
        "Times New Roman": { data: timesRegular },
        "Times New Roman Bold": { data: timesBold },
        "Times New Roman Italic": { data: timesItalic },
        "Times New Roman Bold Italic": { data: timesBoldItalic },
      };
    })();
  }
  return fontsPromise;
}
