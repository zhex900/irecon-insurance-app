/**
 * Module Federation Vite Configuration
 *
 * Main configuration for Module Federation with Cloudflare Workers
 */

import { federation } from "@module-federation/vite";
import { reactRouter } from "@react-router/dev/vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import { stubClientOnlySsr } from "./vite.stub-client-only";
import { generateFederationSharedConfig } from "./federation/shared-deps";

// Module Federation configuration
const federationConfig = {
  // Portal is the host application
  name: "portal",
  filename: "remoteEntry.js",

  // What Portal exposes to other domains
  exposes: {
    "./Shell": "./app/components/shell/AppShell.tsx",
    "./Navigation": "./app/components/shell/Navigation.tsx",
    "./AuthProvider": "./app/lib/auth/AuthProvider.tsx",
    "./QueryClientProvider": "./app/lib/react-query/QueryClientProvider.tsx",
    "./ErrorBoundary": "./app/components/errors/ErrorBoundary.tsx",
  },

  // Remote domains that Portal can load
  remotes: {
    documents: "documents@https://documents.example.com/remoteEntry.js",
    admin: "admin@https://admin.example.com/remoteEntry.js",
  },

  // Shared dependencies
  shared: generateFederationSharedConfig(),

  // Federation runtime options
  // runtimePlugins: ["@module-federation/runtime-plugin"],

  // Additional Federation options
  federationOptions: {
    // Enable shared scope for all remotes
    shareScope: "default",

    // Auto detect remote containers
    remoteType: "var",

    // Runtime plugins
    plugins: [],
  },
};

export default defineConfig({
  plugins: [
    // Module Federation must be first
    federation(federationConfig),

    // Cloudflare SSR support
    stubClientOnlySsr(),
    cloudflare({
      viteEnvironment: { name: "ssr" },
    }),

    // Tailwind CSS
    tailwindcss(),

    // React Router
    reactRouter(),
  ],

  // Build configuration optimized for Module Federation
  build: {
    sourcemap: "hidden",
    target: "es2020",
    minify: true,

    // Module Federation requires specific output format
    rollupOptions: {
      output: {
        // Ensure proper chunking for Federation
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",

        // Format for Module Federation
        format: "esm",

        // Source maps
        sourcemap: true,
      },

      // Externalize dependencies that are shared
      external: Object.keys(generateFederationSharedConfig()),
    },

    // Enable code splitting
    chunkSizeWarningLimit: 1000, // 1MB warning limit
  },

  // Assets configuration
  assetsInclude: ["**/*.ttf"],

  // Resolve configuration
  resolve: {
    dedupe: ["react", "react-dom", "react-router"],
    tsconfigPaths: true,

    // Alias for federation imports
    alias: {
      "@federation": "/federation",
    },
  },

  // Server configuration
  server: {
    port: 5173,
    strictPort: true,
    watch: {
      ignored: ["**/drizzle/**"],
    },

    // CORS for Module Federation development
    cors: true,

    // Proxy for remote modules in development
    proxy: {
      "/documents": {
        target: "http://localhost:5174",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/documents/, ""),
      },
      "/admin": {
        target: "http://localhost:5175",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/admin/, ""),
      },
    },
  },

  // Optimize dependencies
  optimizeDeps: {
    // Pre-bundle shared dependencies
    include: [
      "react",
      "react-dom",
      "react-router",
      "@tanstack/react-query",
      "@supabase/supabase-js",
      "reui",
      "class-variance-authority",
      "clsx",
      "@module-federation/runtime",
    ],

    // Exclude domain-specific heavy deps
    exclude: ["@pdfme/ui", "@tiptap/core", "exceljs"],
  },

  // Environment variables
  define: {
    "process.env.FEDERATION_ENABLED": JSON.stringify(true),
    "process.env.DOCUMENTS_URL": JSON.stringify(
      process.env.VITE_DOCUMENTS_URL || "https://documents.example.com",
    ),
    "process.env.ADMIN_URL": JSON.stringify(
      process.env.VITE_ADMIN_URL || "https://admin.example.com",
    ),
  },
});

// Export configuration helpers for domain workers
export const domainWorkerConfig = {
  // Common configuration for domain workers
  base: {
    plugins: [], // federation plugin should be configured per domain
    build: {
      target: "es2020",
      minify: true,
      sourcemap: true,
    },
    resolve: {
      dedupe: ["react", "react-dom"],
    },
  },

  // Documents domain specific
  documents: {
    federation: {
      name: "documents",
      filename: "remoteEntry.js",
      exposes: {
        "./DocumentDesigner": "./src/exports.ts",
        "./PDFPreview": "./src/exports.ts",
        "./TemplateEditor": "./src/exports.ts",
      },
      shared: {
        // PDF libraries are NOT shared - isolated to Documents
        "@pdfme/ui": { singleton: false },
        "@tiptap/core": { singleton: false },
      },
    },
  },

  // Admin domain specific
  admin: {
    federation: {
      name: "admin",
      filename: "remoteEntry.js",
      exposes: {
        "./UserManagement": "./src/exports.ts",
        "./SettingsDashboard": "./src/exports.ts",
        "./AuditLogViewer": "./src/exports.ts",
      },
      shared: {}, // Admin doesn't have heavy isolated deps
    },
  },
};
