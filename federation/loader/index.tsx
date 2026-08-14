/**
 * Module Federation Loader
 * 
 * Dynamic module loading with error handling, retry logic, and performance tracking
 */

import React from 'react';
import type { ReactNode, ComponentType } from 'react';
import { Suspense, lazy } from 'react';
import { FederationMetrics } from '../monitoring/metrics';
import { FederationErrorBoundary } from './error-boundary';

export interface FederatedComponentProps {
  domain: keyof typeof DOMAIN_URLS;
  module: string;
  version?: string;
  fallback?: ReactNode;
  errorFallback?: ReactNode;
  preload?: boolean;
  retryCount?: number;
  [key: string]: unknown;
}

interface LoaderOptions {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
  cacheKey?: string;
}

// Domain URL configuration
const DOMAIN_URLS = {
  documents: import.meta.env.VITE_DOCUMENTS_URL || 'https://documents.example.com',
  admin: import.meta.env.VITE_ADMIN_URL || 'https://admin.example.com',
  reports: import.meta.env.VITE_REPORTS_URL || 'https://reports.example.com',
} as const;

// Module version tracking
const MODULE_VERSIONS = new Map<string, string>();

/**
 * Core module loader with performance tracking
 */
export async function loadFederatedModule<T = unknown>(
  domain: keyof typeof DOMAIN_URLS,
  module: string,
  version: string = 'latest',
  options: LoaderOptions = {}
): Promise<{ default: ComponentType<T> }> {
  const startTime = Date.now();
  const moduleKey = `${domain}:${module}:${version}`;
  
  try {
    const { timeout = 10000, retries = 3, retryDelay = 1000, cacheKey } = options;
    
    // Track module load start
    FederationMetrics.getInstance().recordModuleLoadStart(domain, module);
    
    // Check cache if provided
    if (cacheKey) {
      const cached = getCachedModule<T>(cacheKey);
      if (cached) {
        FederationMetrics.getInstance().recordModuleLoadComplete(domain, module, Date.now() - startTime);
        return cached;
      }
    }
    
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Load remote entry
        const remoteUrl = `${DOMAIN_URLS[domain]}/remoteEntry.js`;
        
        const container = await loadWithTimeout(
          () => loadFederationContainer(remoteUrl, module, version),
          timeout,
          `Timeout loading ${domain}/${module}`
        );
        
        // Get module factory
        const factory = await container.get(`./${module}`) as () => ComponentType<unknown>;
        
        // Initialize module
        const Module = factory();
        
        // Cache if cacheKey provided
        if (cacheKey) {
          cacheModule(cacheKey, Module);
        }
        
        // Track successful load
        const loadTime = Date.now() - startTime;
        FederationMetrics.getInstance().recordModuleLoadComplete(domain, module, loadTime);
        MODULE_VERSIONS.set(moduleKey, version);
        
        // Module factory should return a component
        return { default: Module as ComponentType<T> };
        
      } catch (error) {
        lastError = error as Error;
        FederationMetrics.getInstance().recordModuleLoadError(domain, module, error as Error, attempt);
        
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
          continue;
        }
      }
    }
    
    throw lastError || new Error(`Failed to load module ${domain}/${module} after ${retries} attempts`);
    
  } catch (error) {
    FederationMetrics.getInstance().recordModuleLoadFailure(domain, module, error as Error);
    throw error;
  }
}

/**
 * Simple PreloadStrategy class implementation
 */
class PreloadStrategy {
  async preloadDomain(domainArg: keyof typeof DOMAIN_URLS, module?: string): Promise<void> {
    // Simple preloading - just attempt to load the module in the background
    const moduleKey = `${domainArg}:${module || 'default'}:latest`;
    
    try {
      // Use a short timeout for background loading
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const preloadPromise = loadFederatedModule(domainArg, module || 'app', 'latest', {
        timeout: 5000,
        retries: 1,
        cacheKey: `preload_${moduleKey}`
      });
      
      // Don't await - let it run in background
      preloadPromise.catch(() => {
        // Ignore preload errors
      });
      
      clearTimeout(timeoutId);
    } catch (_error) {
      // Preload failures are expected and ignored
    }
  }
}

/**
 * Preload a remote module without using it
 */
export async function preloadModule(
  domain: keyof typeof DOMAIN_URLS,
  module?: string
): Promise<void> {
  try {
    const preload = new PreloadStrategy();
    await preload.preloadDomain(domain, module);
  } catch (_error) {
    // Silent failure for preloading - error ignored intentionally
  }
}

/**
 * Create a React lazy component with federation loading
 */
export function createFederatedComponent<T = unknown>(
  domain: keyof typeof DOMAIN_URLS,
  module: string,
  version?: string,
  options?: LoaderOptions
): ComponentType<T> {
  return lazy(() => loadFederatedModule(domain, module, version, options));
}

/**
 * React component wrapper for federated modules
 */
export function FederatedComponent(props: FederatedComponentProps) {
  const {
    domain,
    module,
    version = 'latest',
    fallback = <DefaultLoader />,
    errorFallback = <DefaultErrorFallback domain={domain} module={module} />,
    preload = true,
    retryCount = 2,
    ...restProps
  } = props;
  
  // Preload on mount if enabled
  React.useEffect(() => {
    if (preload) {
      preloadModule(domain, module);
    }
  }, [domain, module, preload]);
  
  return (
    <FederationErrorBoundary 
      domain={domain}
      module={module}
      fallback={errorFallback}
    >
      <Suspense fallback={fallback}>
        <FederatedComponentInner 
          domain={domain}
          module={module} 
          version={version}
          retryCount={retryCount}
          {...restProps}
        />
      </Suspense>
    </FederationErrorBoundary>
  );
}

// Separate component to avoid creating lazy component during render
interface FederatedComponentInnerProps {
  domain: keyof typeof DOMAIN_URLS;
  module: string;
  version?: string;
  retryCount: number;
  [key: string]: unknown;
}

function FederatedComponentInner({
  domain,
  module,
  version,
  retryCount,
  ...restProps
}: FederatedComponentInnerProps) {
  const Component = React.useMemo(
    () => createFederatedComponent(domain, module, version || 'latest', { retries: retryCount }),
    [domain, module, version, retryCount]
  );
  
  return <Component {...restProps} />;
}

// Helper functions
async function loadWithTimeout<T>(
  promiseFn: () => Promise<T>,
  timeout: number,
  timeoutMessage: string
): Promise<T> {
  let timeoutId: NodeJS.Timeout | undefined;
  
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeout);
  });

  try {
    const result = await Promise.race([promiseFn(), timeoutPromise]);
    if (timeoutId) clearTimeout(timeoutId);
    return result;
  } catch (error) {
    if (timeoutId) clearTimeout(timeoutId);
    throw error;
  }
}

async function loadFederationContainer(
  remoteUrl: string,
  module: string,
  version: string
): Promise<{ get: (module: string) => Promise<() => unknown> }> {
  // Use Module Federation runtime to load container
  interface FederationRuntime {
    loadRemote: (options: { 
      name: string; 
      url: string; 
      version: string;
    }) => Promise<{ get: (module: string) => Promise<() => unknown> }>;
  }

  const runtime = (window as typeof window & { federationRuntime?: FederationRuntime }).federationRuntime;

  // Initialize container using Module Federation API
  if (runtime) {
    const container = await runtime.loadRemote({
      name: module,
      url: remoteUrl,
      version,
    });
    return container;
  }

  // Fallback: use dynamic import
  try {
    // Try to load module directly
    const container = await import(/* webpackIgnore: true */ `${remoteUrl}?module=${module}&version=${version}`);
    return container;
  } catch (error) {
    throw new Error(`Failed to load federation container: ${(error as Error).message}`, { cause: error });
  }
}

// Simple in-memory cache for modules
interface CacheEntry {
  module: ComponentType<unknown>;
  timestamp: number;
}
const moduleCache = new Map<string, CacheEntry>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCachedModule<T>(key: string): { default: ComponentType<T> } | null {
  const entry = moduleCache.get(key);
  
  if (entry && Date.now() - entry.timestamp < CACHE_TTL) {
    return { default: entry.module as ComponentType<T> };
  }
  
  if (entry) {
    // Expired, remove from cache
    moduleCache.delete(key);
  }
  
  return null;
}

function cacheModule(key: string, module: ComponentType<unknown>): void {
  moduleCache.set(key, {
    module,
    timestamp: Date.now(),
  });
}

// Default components
function DefaultLoader() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-600"></div>
      <span className="ml-3 text-gray-600">Loading module...</span>
    </div>
  );
}

function DefaultErrorFallback({ domain, module }: { domain: string; module: string }) {
  return (
    <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            Failed to load {domain}/{module}
          </h3>
          <div className="mt-2 text-sm text-red-700">
            <p>
              The component could not be loaded. Please try refreshing the page.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}