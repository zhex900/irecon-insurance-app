# Module Federation Architecture Design

## Overview

Domain-driven micro frontend architecture using Module Federation to split the monolith insurance app into independently deployable domains, starting with PDF-heavy Documents domain for immediate bundle size reduction.

## Architecture Principles

### 1. Domain-Driven Separation

```
Insurance App Domains:
┌─────────────────────┬─────────────────────┬─────────────────────┐
│    Portal Domain    │   Documents Domain   │    Admin Domain     │
│     (Core Shell)    │    (PDF Heavy)       │   (Configuration)   │
├─────────────────────┼─────────────────────┼─────────────────────┤
│ • Auth & Users      │ • PDF Template       │ • System Settings   │
│ • Client Mgmt       │   Designer           │ • User Management   │
│ • Policy List Views │ • Document Editor    │ • Price Config      │
│ • Navigation Shell  │ • PDF Preview        │ • Audit Logs        │
│ • Routing Coord     │ • Template Ver.      │ • Feature Flags    │
│ • Shared State      │ • Merge Fields       │ • Email Templates   │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

### 2. Shared vs Isolated Dependencies

```typescript
// Shared Singletons (loaded once, used by all)
SHARED_DEPS = {
  react: { singleton: true },
  "react-dom": { singleton: true },
  "react-router": { singleton: true },
  "@tanstack/react-query": { singleton: true },
  "@supabase/supabase-js": { singleton: true },
  reui: { singleton: true },
};

// Isolated per Domain (domain-specific)
ISOLATED_DEPS = {
  "@pdfme/ui": "documents", // 24MB only in Documents
  "@tiptap/core": "documents", // 3MB only in Documents
  exceljs: "reports", // Future Reports domain
  recharts: "reports", // Future Reports domain
};
```

### 3. Module Federation Layout

```
Module Federation Host: Portal Worker
├── RemoteEntry.js (exposes shell)
├── Shared Singletons
│   ├── React 19
│   ├── React Router 8
│   ├── TanStack Query
│   └── ReUI Components
│
├── Remote Modules (dynamic)
│   ├── documents@v1.0.0
│   │   ├── DocumentDesigner
│   │   ├── PDFPreview
│   │   └── (PDFME/TiTap isolated)
│   │
│   ├── admin@v1.0.0
│   │   ├── SettingsPage
│   │   ├── UserManagement
│   │   └── AuditLogs
│   │
│   └── reports@v1.0.0 (future)
│       ├── ExcelExporter
│       ├── ReportDashboard
│       └── (ExcelJS isolated)
│
└── Runtime Integration Layer
    ├── Federated Router
    ├── Cross-Domain State
    ├── Error Boundaries
    └── Performance Monitoring
```

## Detailed Architecture Components

### 1. Portal Worker (Shell)

```typescript
// Main responsibilities:
// - Authentication & session management
// - Navigation shell & routing coordination
// - Shared state management
// - Module Federation host

// Structure:
app/
├── components/
│   ├── shell/           # Layout, navigation
│   ├── core/           # Shared UI components
│   └── federation/      # Module Federation integration
├── routes/
│   ├── local/          # Portal-specific routes
│   └── federated/      # Routes to remote modules
├── lib/
│   ├── auth/           # Authentication
│   ├── state/          # Shared state store
│   └── federation/     # Federation utilities
└── federation.config.ts # Module Federation config
```

### 2. Documents Worker (PDF Domain)

```typescript
// Domain responsibilities:
// - PDF template designer (PDFME)
// - Rich text document editor (TiTap)
// - PDF preview generation
// - Template versioning

// Structure:
workers/documents/
├── src/
│   ├── components/
│   │   ├── DocumentDesigner.tsx  # PDFME integration
│   │   ├── TemplateEditor.tsx    # TiTap editor
│   │   ├── PDFPreview.tsx        # Preview component
│   │   └── MergeFieldEditor.tsx  # Insurance-specific
│   ├── hooks/
│   │   ├── usePDFPreview.ts
│   │   ├── useTemplateHistory.ts
│   │   └── useDocumentAutoSave.ts
│   ├── services/
│   │   ├── pdf.generator.ts      # Client-side PDF
│   │   ├── template.service.ts   # Business logic
│   │   └── versioning.service.ts # Template versions
│   ├── types/
│   │   └── documents.types.ts    # Domain types
│   └── entry.tsx                 # React entry point
├── package.json                   # Own dependencies
└── federation.config.ts          # Module Federation exports
```

### 3. Admin Worker (Configuration Domain)

```typescript
// Domain responsibilities:
// - System configuration UI
// - User management
// - Price catalogue management
// - Audit logs & reporting

// Structure:
workers/admin/
├── src/
│   ├── components/
│   │   ├── UserManagement/
│   │   ├── SettingsDashboard/
│   │   ├── PriceConfiguration/
│   │   └── AuditLogViewer/
│   ├── hooks/
│   │   ├── useUserPermissions.ts
│   │   └── useAuditLogs.ts
│   ├── services/
│   │   ├── user.service.ts
│   │   ├── settings.service.ts
│   │   └── audit.service.ts
│   └── exports.ts                # Federated exports
└── federation.config.ts
```

## Module Federation Implementation

### Configuration Files

**Portal Federation Config**:

```typescript
// vite.config.federation.ts
import { federation } from "@module-federation/vite";

export default defineConfig({
  plugins: [
    federation({
      name: "portal",
      filename: "remoteEntry.js",
      exposes: {
        "./Shell": "./src/components/shell/AppShell.tsx",
        "./Navigation": "./src/components/shell/Navigation.tsx",
        "./AuthProvider": "./src/lib/auth/AuthProvider.tsx",
      },
      remotes: {
        documents: "documents@https://documents.example.com/remoteEntry.js",
        admin: "admin@https://admin.example.com/remoteEntry.js",
      },
      shared: {
        react: { singleton: true, requiredVersion: "^19.0.0" },
        "react-dom": { singleton: true, requiredVersion: "^19.0.0" },
        "react-router": { singleton: true },
        "@tanstack/react-query": { singleton: true },
        "@supabase/supabase-js": { singleton: true },
        reui: { singleton: true },
      },
    }),
  ],
});
```

**Documents Federation Config**:

```typescript
// workers/documents/vite.config.ts
export default defineConfig({
  plugins: [
    federation({
      name: "documents",
      filename: "remoteEntry.js",
      exposes: {
        "./DocumentDesigner": "./src/exports.ts",
        "./PDFPreview": "./src/exports.ts",
        "./TemplateEditor": "./src/exports.ts",
      },
      // Documents brings heavy deps - DON'T share
      shared: {
        // PDF libraries isolated to Documents only
        "@pdfme/ui": { singleton: false, requiredVersion: "^6.1.12" },
        "@tiptap/core": { singleton: false, requiredVersion: "^3.29.2" },
      },
    }),
  ],
});
```

### Runtime Integration Layer

**Federated Loader**:

```typescript
// app/components/federation/FederatedLoader.tsx
import { lazy, Suspense, ComponentType } from 'react';

interface FederatedComponentProps {
  domain: 'documents' | 'admin' | 'reports';
  module: string;
  fallback?: React.ReactNode;
  errorFallback?: React.ReactNode;
  version?: string;
} & Record<string, any>;

export function FederatedComponent({
  domain,
  module,
  fallback = <DefaultLoader />,
  errorFallback = <ErrorFallback domain={domain} />,
  version = 'latest',
  ...props
}: FederatedComponentProps) {
  const Component = lazy(() =>
    importFederatedModule(domain, module, version)
  );

  return (
    <ErrorBoundary fallback={errorFallback}>
      <Suspense fallback={fallback}>
        <Component {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

async function importFederatedModule(
  domain: string,
  module: string,
  version: string
): Promise<{ default: ComponentType }> {
  // Load remote entry
  const container = await loadFederationContainer(domain, version);

  // Get module factory
  const factory = await container.get(`./${module}`);

  // Return module
  const Module = factory();
  return { default: Module.default || Module };
}
```

**Cross-Domain Router**:

```typescript
// app/routes/federated-routes.ts
export const federatedRoutes = [
  {
    path: 'documents/*',
    lazy: () => import('./routes/documents'),
    children: [
      {
        path: 'designer/:templateId',
        element: (
          <FederatedComponent
            domain="documents"
            module="DocumentDesigner"
            fallback={<DocumentDesignerSkeleton />}
          />
        ),
      },
      {
        path: 'preview/:templateId',
        element: (
          <FederatedComponent
            domain="documents"
            module="PDFPreview"
            fallback={<PreviewSkeleton />}
          />
        ),
      },
    ],
  },
  {
    path: 'admin/*',
    lazy: () => import('./routes/admin'),
    children: [
      {
        path: 'users',
        element: (
          <FederatedComponent
            domain="admin"
            module="UserManagement"
            fallback={<UsersSkeleton />}
          />
        ),
      },
      {
        path: 'settings',
        element: (
          <FederatedComponent
            domain="admin"
            module="SettingsDashboard"
            fallback={<SettingsSkeleton />}
          />
        ),
      },
    ],
  },
];
```

## State Management Across Domains

### Centralized State Store

```typescript
// federation/state-store.ts
export class CrossDomainStateStore {
  private static instance: CrossDomainStateStore;
  private state = new Map<string, any>();
  private listeners = new Map<string, Set<Function>>();

  static getInstance(): CrossDomainStateStore {
    if (!CrossDomainStateStore.instance) {
      CrossDomainStateStore.instance = new CrossDomainStateStore();
    }
    return CrossDomainStateStore.instance;
  }

  // Domain-specific state
  setDomainState(domain: string, key: string, value: any) {
    const stateKey = `${domain}:${key}`;
    const oldValue = this.state.get(stateKey);
    this.state.set(stateKey, value);

    // Notify listeners
    this.notifyListeners(domain, key, value, oldValue);
  }

  getDomainState<T>(domain: string, key: string): T | null {
    return this.state.get(`${domain}:${key}`) || null;
  }

  // Cross-domain subscriptions
  subscribe(domain: string, key: string, callback: Function) {
    const listenerKey = `${domain}:${key}`;

    if (!this.listeners.has(listenerKey)) {
      this.listeners.set(listenerKey, new Set());
    }

    this.listeners.get(listenerKey)!.add(callback);

    return () => {
      this.listeners.get(listenerKey)?.delete(callback);
    };
  }

  private notifyListeners(
    domain: string,
    key: string,
    newValue: any,
    oldValue: any,
  ) {
    const listenerKey = `${domain}:${key}`;
    const listeners = this.listeners.get(listenerKey);

    if (listeners) {
      listeners.forEach((callback) => {
        try {
          callback(newValue, oldValue);
        } catch (error) {
          console.error("Listener error:", error);
        }
      });
    }
  }
}
```

### Event-Based Communication

```typescript
// federation/event-bus.ts
export class CrossDomainEventBus {
  private events = new EventTarget();

  emit(event: string, data: any) {
    this.events.dispatchEvent(new CustomEvent(event, { detail: data }));
  }

  on(event: string, handler: (data: any) => void) {
    const wrappedHandler = (e: CustomEvent) => handler(e.detail);
    this.events.addEventListener(event, wrappedHandler);

    return () => {
      this.events.removeEventListener(event, wrappedHandler);
    };
  }

  // Domain-specific events
  static EVENTS = {
    USER_UPDATED: "user:updated",
    TEMPLATE_SAVED: "template:saved",
    SETTINGS_CHANGED: "settings:changed",
    PDF_GENERATED: "pdf:generated",
  };
}

// Usage example:
// In Documents domain when template saves
eventBus.emit(CrossDomainEventBus.EVENTS.TEMPLATE_SAVED, template);

// In Portal domain to update list view
eventBus.on(CrossDomainEventBus.EVENTS.TEMPLATE_SAVED, (template) => {
  invalidateQueries(["templates"]);
});
```

## Performance Optimization Strategies

### 1. Module Preloading

```typescript
// federation/preloading.ts
export class ModulePreloader {
  private preloaded = new Set<string>();

  // Preload on user intent prediction
  preloadOnIntent() {
    // When user hovers over documents link
    document.addEventListener("mouseover", (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('[data-preload="documents"]')) {
        this.preloadDomain("documents");
      }
    });

    // Preload based on user role
    if (userIsAdmin()) {
      this.preloadDomain("admin");
    }
  }

  async preloadDomain(domain: string) {
    if (this.preloaded.has(domain)) return;

    // Load remote entry in background
    const url = this.getDomainUrl(domain);
    await import(/* @vite-ignore */ `${url}/remoteEntry.js`);

    this.preloaded.add(domain);
  }
}
```

### 2. Bundle Splitting Optimization

```typescript
// Optimize shared chunks
optimization: {
  splitChunks: {
    chunks: 'all',
    cacheGroups: {
      vendors: {
        test: /[\\/]node_modules[\\/]/,
        name: 'vendors',
        chunks: 'all',
        priority: 10,
      },
      shared: {
        name: 'shared',
        test: /[\\/]shared[\\/]/,
        chunks: 'all',
        priority: 20,
      },
      domain: {
        name: (module) => {
          // Split by domain
          const match = module.resource?.match(/domains\/([^\/]+)/);
          return match ? `domain-${match[1]}` : null;
        },
        chunks: 'all',
        priority: 30,
      },
    },
  },
},
```

### 3. Caching Strategy

```typescript
// federation/caching.ts
export class FederationCache {
  private cache = new Map<string, CacheEntry>();

  async getOrLoad<T>(
    key: string,
    loader: () => Promise<T>,
    options: CacheOptions,
  ): Promise<T> {
    const entry = this.cache.get(key);

    if (entry && !this.isExpired(entry)) {
      return entry.data as T;
    }

    // Load and cache
    const data = await loader();
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: options.ttl,
    });

    return data;
  }

  // Invalidate domain cache
  invalidateDomain(domain: string) {
    for (const [key] of this.cache) {
      if (key.startsWith(`${domain}:`)) {
        this.cache.delete(key);
      }
    }
  }
}
```

## Deployment Architecture

### Worker Deployment Strategy

```yaml
# Each domain deploys independently
domains:
  portal:
    name: insurance-portal
    routes:
      - example.com/*
    dependencies: [shared]

  documents:
    name: insurance-documents
    routes:
      - documents.example.com
      - example.com/documents/*
    dependencies: [portal] # Depends on portal auth

  admin:
    name: insurance-admin
    routes:
      - admin.example.com
      - example.com/admin/*
    dependencies: [portal]

deployment_order:
  # On new feature:
  1. Deploy documents (if PDF changes)
  2. Deploy admin (if settings changes)
  3. Deploy portal (shell/features)

  # Rollback: reverse order
```

### Version Compatibility

```typescript
// version-compatibility.ts
export const DOMAIN_COMPATIBILITY = {
  // Required version compatibility
  "portal@1.x": {
    documents: ">=1.0.0 <2.0.0",
    admin: ">=1.0.0 <2.0.0",
  },

  "documents@2.x": {
    portal: ">=1.5.0", // Breaking change requires portal update
  },
};

export function checkCompatibility(
  portalVersion: string,
  domain: string,
  domainVersion: string,
): boolean {
  const compatibility = DOMAIN_COMPATIBILITY[`portal@${portalVersion}`];
  if (!compatibility) return false;

  const requiredRange = compatibility[domain];
  return semver.satisfies(domainVersion, requiredRange);
}
```

## Monitoring & Observability

### Performance Metrics

```typescript
// federation/metrics.ts
export class FederationMetrics {
  // Module load times
  private moduleLoadTimes = new Map<string, number[]>();

  // Cross-domain calls
  private crossDomainCalls = new Map<string, number>();

  // Error tracking
  private errorCounts = new Map<string, number>();

  recordModuleLoad(domain: string, time: number) {
    const times = this.moduleLoadTimes.get(domain) || [];
    times.push(time);
    this.moduleLoadTimes.set(domain, times);

    // Alert if slow
    if (time > 1000) {
      this.alertSlowLoad(domain, time);
    }
  }

  recordCrossDomainCall(source: string, target: string) {
    const key = `${source}→${target}`;
    const count = this.crossDomainCalls.get(key) || 0;
    this.crossDomainCalls.set(key, count + 1);
  }

  getPerformanceScore(): number {
    const avgLoadTimes = Array.from(this.moduleLoadTimes.entries()).map(
      ([_, times]) => times.reduce((a, b) => a + b, 0) / times.length,
    );

    const avgLoadTime =
      avgLoadTimes.reduce((a, b) => a + b, 0) / avgLoadTimes.length;

    // Lower load time = higher score
    const loadTimeScore = Math.max(0, 2000 - avgLoadTime) / 20;

    return Math.min(100, loadTimeScore);
  }
}
```

### Health Dashboard

```typescript
// app/components/dashboard/FederationHealth.tsx
export function FederationHealthDashboard() {
  const [health, setHealth] = useState<DomainHealth[]>([]);

  useEffect(() => {
    const checkDomains = async () => {
      const domains = ['documents', 'admin', 'reports'];

      const healthChecks = await Promise.all(
        domains.map(async (domain) => {
          const response = await fetch(
            `https://${domain}.example.com/health`
          );

          return {
            domain,
            status: response.ok ? 'healthy' : 'unhealthy',
            version: response.headers.get('x-federation-version'),
            lastChecked: new Date().toISOString(),
          };
        })
      );

      setHealth(healthChecks);
    };

    checkDomains();
    const interval = setInterval(checkDomains, 30000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {health.map((domain) => (
        <DomainHealthCard key={domain.domain} domain={domain} />
      ))}
    </div>
  );
}
```

## Conclusion

This Module Federation architecture provides:

1. **Domain isolation**: PDF libraries isolated to Documents domain
2. **Independent scaling**: Each domain scales based on its load
3. **Team autonomy**: Different teams can own different domains
4. **Performance optimization**: Lazy loading, preloading, caching
5. **Graceful degradation**: Iframe fallback for failed modules
6. **Incremental adoption**: Start with Documents, expand gradually

The key success factor is **starting with the Documents domain** where the biggest bundle size reduction (PDFME/TiTap) provides immediate value while establishing the patterns for future domains.
