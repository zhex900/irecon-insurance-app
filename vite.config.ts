import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { stubClientOnlySsr } from "./vite.stub-client-only";

export default defineConfig({
  plugins: [
    stubClientOnlySsr(),
    cloudflare({ viteEnvironment: { name: "ssr" } }),
    tailwindcss(),
    reactRouter(),
  ],
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
    include: ["react", "react-dom"],
  },
});
