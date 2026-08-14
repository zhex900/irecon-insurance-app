/**
 * Documents Domain Vite Configuration
 * Module Federation config for documents domain
 */

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { federation } from "@module-federation/vite";
import tailwindcss from "@tailwindcss/vite";

// Documents domain exposes PDF-heavy components
const federationConfig = {
  name: "documents",
  filename: "remoteEntry.js",

  // Exposed components (loaded by Portal)
  exposes: {
    "./DocumentDesigner": "./src/exports.ts",
    "./PDFPreview": "./src/exports.ts",
    "./TemplateEditor": "./src/exports.ts",
    "./MergeFieldEditor": "./src/exports.ts",
  },

  // Documents domain brings heavy dependencies - DO NOT share
  shared: {
    // PDF libraries isolated to Documents only
    "@pdfme/ui": {
      singleton: false, // NOT shared - each domain loads its own
      requiredVersion: "^6.1.12",
    },
    "@pdfme/generator": { singleton: false },
    "@pdfme/schemas": { singleton: false },
    "@pdfme/converter": { singleton: false },
    "@pdfme/common": { singleton: false },

    // TiTap libraries isolated to Documents only
    "@tiptap/core": { singleton: false },
    "@tiptap/react": { singleton: false },
    "@tiptap/starter-kit": { singleton: false },
    "@tiptap/extension-placeholder": { singleton: false },
    "@tiptap/extension-underline": { singleton: false },
    "@tiptap/extension-text-style": { singleton: false },
    "@tiptap/extension-font-family": { singleton: false },

    // Shared singletons (loaded from Portal)
    react: { singleton: true, requiredVersion: "^19.0.0" },
    "react-dom": { singleton: true, requiredVersion: "^19.0.0" },
    "react-router": { singleton: true },
    "@tanstack/react-query": { singleton: true },
    reui: { singleton: true },
  },
};

export default defineConfig({
  plugins: [
    // Module Federation must be first
    federation(federationConfig),

    // React plugin
    react(),

    // Tailwind CSS
    tailwindcss(),
  ],

  // Build configuration
  build: {
    target: "es2020",
    minify: true,
    sourcemap: true,

    // Output configuration optimized for Module Federation
    rollupOptions: {
      output: {
        // Proper chunking for Federation
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",

        // ES module format required by Module Federation
        format: "esm",

        // Export conditions
        exports: "named",
      },

      // Externalize shared dependencies (they come from Portal)
      external: [
        "react",
        "react-dom",
        "react-router",
        "@tanstack/react-query",
        "reui",
      ],
    },

    // Don't allow large chunks
    chunkSizeWarningLimit: 5000, // 5MB warning (PDF libraries are heavy)
  },

  // Resolve configuration
  resolve: {
    dedupe: ["react", "react-dom"],

    // Alias for easier imports
    alias: {
      "@": "/src",
    },
  },

  // Server configuration (for development)
  server: {
    port: 5174,
    strictPort: true,
    cors: true,

    // Proxy to Portal for shared dependencies
    proxy: {
      "/@fs": {
        target: "http://localhost:5173",
        changeOrigin: true,
      },
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    // Exclude PDF/TiTap from pre-bundling (they're heavy)
    exclude: [
      "@pdfme/ui",
      "@pdfme/generator",
      "@pdfme/schemas",
      "@pdfme/converter",
      "@pdfme/common",
      "@tiptap/core",
      "@tiptap/react",
      "@tiptap/starter-kit",
    ],

    // Include shared deps
    include: [
      "react",
      "react-dom",
      "react-router",
      "@tanstack/react-query",
      "reui",
    ],
  },

  // Environment variables
  define: {
    "process.env.NODE_ENV": JSON.stringify(
      process.env.NODE_ENV || "development",
    ),
    "process.env.FEDERATION_DOMAIN": JSON.stringify("documents"),
  },
});

// Worker-specific configuration (for Cloudflare Workers)
export const workerConfig = {
  ssr: {
    // SSR configuration for Cloudflare Workers
    noExternal: ["@pdfme/ui", "@tiptap/core"],
  },

  // Worker output configuration
  build: {
    ssr: true,
    rollupOptions: {
      output: {
        // Cloudflare Workers specific format
        format: "esm",
        dir: "dist",
        entryFileNames: "[name].js",
        chunkFileNames: "[name].js",
      },
    },
  },
};
