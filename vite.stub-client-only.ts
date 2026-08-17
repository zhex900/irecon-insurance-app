import type { Plugin } from "vite";

/**
 * Packages that must never ship in the Cloudflare Worker / SSR graph.
 * They are browser-only UI (pdfme Designer, React Email TipTap editor) and
 * are loaded via dynamic `import()` after mount on the client.
 *
 * Do not stub exceljs — `/api/reports/*.xlsx` builds workbooks on the Worker
 * (dynamic import in `*.server.ts` only). Premium Excel still loads exceljs
 * in the browser bundle, not SSR.
 *
 * Without stubbing, Vite still emits huge SSR chunks for those dynamic
 * imports and Wrangler uploads them — blowing the free plan 3 MiB gzip limit.
 */
const CLIENT_ONLY_PREFIXES = [
  "@pdfme/generator",
  "@pdfme/schemas",
  "@pdfme/ui",
  "@pdfme/converter",
  "@react-email/editor",
  "@tiptap/core",
  "@tiptap/react",
  "@tiptap/pm",
  "@tiptap/starter-kit",
  "@tiptap/suggestion",
  "@tiptap/extension-placeholder",
  "@tiptap/extension-underline",
  "@tiptap/extension-text-style",
  "@tiptap/extension-font-family",
  "prosemirror-model",
  "prosemirror-state",
  "prosemirror-view",
  "prosemirror-transform",
  "prosemirror-commands",
  "prosemirror-keymap",
  "prosemirror-schema-list",
  "prosemirror-history",
  "prosemirror-tables",
  "next-themes",
] as const;

const CLIENT_ONLY_MODULE_SUFFIXES = [
  "/app/lib/pdf/generate.ts",
  "/app/lib/pdf/pdf-plugins.ts",
] as const;

function isClientOnlyPackage(id: string): boolean {
  // Let Vite/Tailwind handle CSS from these packages; only stub JS modules.
  if (id.endsWith(".css") || id.includes(".css?")) return false;
  return CLIENT_ONLY_PREFIXES.some(
    (prefix) => id === prefix || id.startsWith(`${prefix}/`),
  );
}

function isClientOnlyModule(id: string): boolean {
  return (
    id === "~/lib/pdf/generate" ||
    id === "~/lib/pdf/pdf-plugins" ||
    CLIENT_ONLY_MODULE_SUFFIXES.some((suffix) => id.endsWith(suffix))
  );
}

/** Minimal ESM stub so SSR/dynamic-import analysis stays happy. */
const STUB_SOURCE = `
export default {};
export const Designer = class { constructor() {} destroy() {} getTemplate() { return null; } };
export const generate = async () => new Uint8Array();
export const ThemeProvider = ({ children }) => children;
export const useTheme = () => ({ theme: "light", setTheme: () => {} });
export const text = {};
export const multiVariableText = {};
export const table = {};
export const image = {};
export const line = {};
export const rectangle = {};
export const pdfmePlugins = {};
export const EmailEditor = () => null;
export const StarterKit = { configure: () => ({}) };
export const EmailTheming = { configure: () => ({}) };
export const Placeholder = { configure: () => ({}) };
export const Extension = { create: () => ({}) };
export const Plugin = class {};
export const PluginKey = class { constructor() {} };
export const Decoration = { empty: {} };
export const DecorationSet = {};
export const Suggestion = () => ({}) ;
export const Inspector = {
  Root: () => null,
  Breadcrumb: () => null,
  Document: () => null,
  Node: () => null,
  Text: () => null,
};
export const defaultSlashCommands = [];
export const TableIcon = () => null;
export const invalidatePdfTemplateOverrideCache = () => {};
export const buildPdfBlobFromDocument = async () => new Blob();
export const buildPdfBlobFromPolicy = async () => new Blob();
`;

/**
 * Replace browser-only packages with empty stubs in the SSR / Worker build.
 * Client builds resolve the real packages as usual.
 */
export function stubClientOnlySsr(): Plugin {
  return {
    name: "stub-client-only-ssr",
    enforce: "pre",
    applyToEnvironment(environment) {
      return environment.name === "ssr";
    },
    resolveId(id) {
      if (!isClientOnlyPackage(id) && !isClientOnlyModule(id)) return null;
      return `\0client-only-stub:${id}`;
    },
    load(id) {
      if (!id.startsWith("\0client-only-stub:")) return null;
      return STUB_SOURCE;
    },
  };
}
