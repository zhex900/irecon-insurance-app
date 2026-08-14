import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "build/**",
      ".wrangler/**",
      ".react-router/**",
      ".tmp/**",
      "coverage/**",
      "test-results/**",
      "playwright-report/**",
      "node_modules/**",
      "_archive/**",
      "supabase/**",
      "drizzle/**",
      "public/**",
      "workers/*-env.d.ts",
      // Ops / one-off scripts — not part of the app lint gate.
      "scripts/**",
      "test-excel-worker.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2022,
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": [
        "error",
        {
          allowConstantExport: true,
          allowExportNames: [
            "meta",
            "links",
            "headers",
            "loader",
            "action",
            "clientLoader",
            "clientAction",
            "handle",
            "shouldRevalidate",
            "HydrateFallback",
          ],
        },
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },
  {
    files: ["app/routes/**/*.{ts,tsx}"],
    rules: {
      // Route modules export loader/action/meta/default — not just components.
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: ["app/**/*.{ts,tsx}"],
    ignores: [
      "app/components/ui/**/*.{ts,tsx}",
      "app/components/reui/**/*.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: "Literal[value=/\\bspace-[xy]-/]",
          message:
            "Use flex/grid with gap-* instead of space-x-* or space-y-*.",
        },
        {
          selector: "TemplateElement[value.raw=/\\bspace-[xy]-/]",
          message:
            "Use flex/grid with gap-* instead of space-x-* or space-y-*.",
        },
        {
          selector:
            "Literal[value=/(?:bg|text|border|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]+/]",
          message: "Use semantic design-system color tokens.",
        },
        {
          selector:
            "TemplateElement[value.raw=/(?:bg|text|border|ring|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]+/]",
          message: "Use semantic design-system color tokens.",
        },
      ],
    },
  },
  {
    files: [
      "app/components/ui/**/*.{ts,tsx}",
      "app/components/reui/**/*.{ts,tsx}",
    ],
    rules: {
      // shadcn/ReUI primitives often export helpers alongside components.
      "react-refresh/only-export-components": "off",
    },
  },
  {
    files: [
      // Intentional mixed modules: hooks + components / layout helpers.
      "app/components/forms/field-save-highlight.tsx",
      "app/components/policies/policy-form-layout.tsx",
      "app/components/policies/wizard/section-shared.tsx",
      "app/components/policies/wizard/car-policy-wizard-mode-context.tsx",
      // Federation loader exports both functions and components
      "federation/loader/index.tsx",
    ],
    rules: {
      "react-refresh/only-export-components": "off",
      "react-hooks/static-components": "off",
    },
  },
  {
    files: [
      "workers/**/*.{ts,tsx}",
      "e2e/**/*.{ts,tsx}",
      "tests/**/*.{ts,tsx}",
    ],
    rules: {
      "no-console": "off",
      "react-refresh/only-export-components": "off",
    },
  },
  eslintConfigPrettier,
);
