import * as htmlPlugin from "prettier/plugins/html";
import { format } from "prettier/standalone";

/** Pretty-print email HTML for the Code editor (browser-safe Prettier). */
export async function formatEmailHtml(html: string): Promise<string> {
  const source = html.trim();
  if (!source) return html;

  try {
    return await format(source, {
      parser: "html",
      plugins: [htmlPlugin],
      printWidth: 100,
      tabWidth: 2,
      useTabs: false,
      htmlWhitespaceSensitivity: "ignore",
      bracketSameLine: false,
    });
  } catch {
    return html;
  }
}
