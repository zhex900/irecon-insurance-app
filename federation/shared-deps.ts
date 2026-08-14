/**
 * Shared Dependency Configuration for Module Federation
 *
 * Defines which dependencies are shared singletons vs isolated per domain
 */

// Types for shared configuration
type SharedConfigEntry = {
  singleton: true;
  requiredVersion?: string;
  eager?: boolean;
};

// Shared Singletons (loaded once, used by all domains)
export const SHARED_SINGLETONS = {
  react: {
    singleton: true,
    requiredVersion: "^19.0.0",
    eager: true, // Load immediately
  },
  "react-dom": {
    singleton: true,
    requiredVersion: "^19.0.0",
    eager: true,
  },
  "react-router": {
    singleton: true,
    requiredVersion: "^8.0.0",
  },
  "@tanstack/react-query": {
    singleton: true,
    requiredVersion: "^5.0.0",
  },
  "@supabase/supabase-js": {
    singleton: true,
    requiredVersion: "^2.0.0",
  },
  reui: {
    singleton: true,
    requiredVersion: "^0.0.0",
  },
  "class-variance-authority": {
    singleton: true,
  },
  clsx: {
    singleton: true,
  },
} as const;

// Module Federation-specific shared
export const FEDERATION_SHARED = {
  "@module-federation/runtime": {
    singleton: true,
    requiredVersion: "^3.0.0",
  },
  "@module-federation/sdk": {
    singleton: true,
    requiredVersion: "^3.0.0",
  },
} as const;

// Isolated Dependencies (domain-specific)
export const ISOLATED_DEPS = {
  // Documents Domain Only
  "@pdfme/ui": "documents",
  "@pdfme/generator": "documents",
  "@pdfme/schemas": "documents",
  "@pdfme/converter": "documents",
  "@pdfme/common": "documents",
  "@tiptap/core": "documents",
  "@tiptap/react": "documents",
  "@tiptap/starter-kit": "documents",
  "@tiptap/extension-placeholder": "documents",
  "@tiptap/extension-underline": "documents",
  "@tiptap/extension-text-style": "documents",
  "@tiptap/extension-font-family": "documents",

  // Admin Domain Only
  // (Future - admin-specific heavy deps)

  // Reports Domain Only (Future)
  exceljs: "reports",
  recharts: "reports",
} as const;

// Combined configuration for Module Federation
export const FEDERATION_CONFIG = {
  ...SHARED_SINGLETONS,
  ...FEDERATION_SHARED,
} as const;

// Helper functions
export function isSharedDependency(depName: string): boolean {
  return depName in SHARED_SINGLETONS;
}

export function isFederationShared(depName: string): boolean {
  return depName in FEDERATION_SHARED;
}

export function isIsolatedDependency(depName: string): string | null {
  return ISOLATED_DEPS[depName as keyof typeof ISOLATED_DEPS] || null;
}

export function getIsolatedDomain(depName: string): string | null {
  return ISOLATED_DEPS[depName as keyof typeof ISOLATED_DEPS] || null;
}

// Validation functions
export function validateDependencyIsolation(): string[] {
  const warnings: string[] = [];

  // Check for potential shared deps that should be isolated
  const potentialIssues = ["@pdfme/ui", "@tiptap/core", "exceljs"];

  potentialIssues.forEach((dep) => {
    if (isSharedDependency(dep)) {
      warnings.push(
        `Warning: ${dep} is configured as shared but should be isolated`,
      );
    }
  });

  return warnings;
}

// Generate Module Federation config
export function generateFederationSharedConfig(): Record<
  string,
  SharedConfigEntry
> {
  const sharedConfig: Record<string, SharedConfigEntry> = {};

  // Add shared singletons
  Object.entries(SHARED_SINGLETONS).forEach(([dep, config]) => {
    sharedConfig[dep] = config;
  });

  // Add federation-specific
  Object.entries(FEDERATION_SHARED).forEach(([dep, config]) => {
    sharedConfig[dep] = config;
  });

  return sharedConfig;
}
