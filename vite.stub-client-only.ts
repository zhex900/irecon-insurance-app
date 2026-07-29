import type { Plugin } from "vite";

/**
 * Packages that must never ship in the Cloudflare Worker / SSR graph.
 * They are browser-only UI (pdfme Designer, React Email TipTap editor) and
 * are loaded via dynamic `import()` after mount on the client.
 *
 * Without stubbing, Vite still emits huge SSR chunks for those dynamic
 * imports and Wrangler uploads them — blowing the free plan 3 MiB gzip limit.
 */
const CLIENT_ONLY_PREFIXES = [
  "@pdfme/ui",
  "@pdfme/converter",
  "@react-email/editor",
  "@tiptap/core",
  "@tiptap/pm",
  "@tiptap/suggestion",
  "@tiptap/extension-placeholder",
  "prosemirror-model",
  "prosemirror-state",
  "prosemirror-view",
  "prosemirror-transform",
  "prosemirror-commands",
  "prosemirror-keymap",
  "prosemirror-schema-list",
  "prosemirror-history",
  "prosemirror-tables",
] as const;

function isClientOnlyPackage(id: string): boolean {
  // Let Vite/Tailwind handle CSS from these packages; only stub JS modules.
  if (id.endsWith(".css") || id.includes(".css?")) return false;
  return CLIENT_ONLY_PREFIXES.some(
    (prefix) => id === prefix || id.startsWith(`${prefix}/`),
  );
}

/** Minimal ESM stub so SSR/dynamic-import analysis stays happy. */
const STUB_SOURCE = `
export default {};
export const Designer = class { constructor() {} destroy() {} getTemplate() { return null; } updateTemplate() {} };
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
      if (!isClientOnlyPackage(id)) return null;
      return `\0client-only-stub:${id}`;
    },
    load(id) {
      if (!id.startsWith("\0client-only-stub:")) return null;
      return STUB_SOURCE;
    },
  };
}
