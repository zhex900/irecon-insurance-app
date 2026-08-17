import { cloudflare } from "@cloudflare/vite-plugin";
import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

import { stubClientOnlySsr } from "./vite.stub-client-only.ts";

export default defineConfig({
  plugins: [
    stubClientOnlySsr(),
    cloudflare({
      viteEnvironment: { name: "ssr" },
    }),
    tailwindcss(),
    reactRouter(),
  ],
  // Emit .map for Sentry; omit //# sourceMappingURL so maps are not public.
  // deploy-staging deletes *.map after upload (before wrangler deploy).
  build: {
    sourcemap: "hidden",
  },
  assetsInclude: ["**/*.ttf"],
  resolve: {
    dedupe: ["react", "react-dom"],
    tsconfigPaths: true,
  },
  server: {
    // Keep in sync with supabase/config.toml [auth].site_url (password-reset emails).
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/drizzle/**"],
    },
  },
  optimizeDeps: {
    // Pre-bundle TipTap (client dynamic import after mount). Avoids
    // "504 Outdated Optimize Dep" on first /settings/car-wording visit.
    // Do not include `@tiptap/pm` — it has no "." export (subpaths only).
    include: [
      "react",
      "react-dom",
      "@tiptap/react",
      "@tiptap/core",
      "@tiptap/starter-kit",
      "@tiptap/suggestion",
      "@tiptap/extension-placeholder",
      "@tiptap/extension-underline",
      "@tiptap/extension-text-style",
      "@tiptap/extension-font-family",
    ],
    exclude: ["react/jsx-dev-runtime", "react/jsx-runtime", "@sentry/react"],
  },
});
