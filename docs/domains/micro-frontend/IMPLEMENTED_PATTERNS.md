# Micro-Frontend Implementation Patterns (Implemented)

**Status: ACTIVE**  
**Last Updated: Aug 15, 2026**  
**Pattern: Domain-Based Worker Isolation**

## Overview

This document captures the **implemented** micro-frontend patterns in the Irecon Insurance application. These patterns establish a scalable, maintainable architecture where heavy dependencies are isolated in domain-specific Workers.

## Current Implementation Pattern

### Pattern 1: Domain Worker Isolation

**Objective**: Separate heavy, domain-specific dependencies from the main portal application into dedicated Cloudflare Workers.

**Implemented Example**: `documents` domain worker for PDF template editing.

#### Directory Structure Pattern

```
workers/{domain}/
├── package.json                    # Domain-specific dependencies
├── vite.config.ts                  # Module Federation configuration
├── wrangler.{domain}.jsonc         # Worker configuration
├── index.ts                        # Worker entry point (API server)
└── src/
    ├── exports/                    # Federated component exports
    │   ├── ComponentName.tsx       # Export entry points
    │   └── index.ts               # Barrel exports
    ├── components/                 # Domain-specific components
    ├── hooks/                      # Domain-specific hooks
    └── utils/                      # Domain utilities
```

#### Key Implementation Details

**Worker Responsibilities**:
- Host domain-specific heavy dependencies (PDFME, TiTap, etc.)
- Serve federated components via Module Federation
- Provide domain-specific APIs
- Handle domain-specific business logic

**Portal Responsibilities**:
- Core navigation and routing
- Authentication and user management
- Lightweight UI components
- Cross-domain coordination

#### Dependency Strategy

**Isolated in Worker**:
```typescript
// workers/documents/package.json
{
  "dependencies": {
    "@pdfme/ui": "^6.1.12",        // 24MB isolated from portal
    "@pdfme/generator": "^6.1.12", // PDF generation
    "@tiptap/core": "^3.29.2",     // Rich text editor (3MB)
    "@tiptap/react": "^3.29.2"     // React wrapper
  }
}
```

**Shared Singletons** (loaded once across all domains):
```typescript
// Portal Vite configuration
shared: {
  react: { singleton: true, requiredVersion: '^19.0.0' },
  'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
}
```

## Communication Patterns

### RPC (Remote Procedure Call) Pattern

**Used For**: Cross-worker communication between portal and domain workers.

**Implementation**:
```typescript
// Portal client calls domain worker
const response = await fetch('https://documents-worker.irecon.com/api/templates/validate', {
  method: 'POST',
  body: JSON.stringify(templateData),
});

// Documents worker processes request
app.post('/api/templates/validate', async (c) => {
  const body = await c.req.json();
  // Validate using PDFME libraries isolated to this worker
  return c.json({ valid: true, errors: [] });
});
```

### Module Federation Pattern

**Used For**: Component-level integration between portal and domain workers.

**Implementation**:
```typescript
// Portal Vite configuration
federation({
  name: 'portal',
  remotes: {
    documents: 'documents@https://documents-worker.irecon.com/remoteEntry.js',
  },
});

// Portal component usage
const DocumentDesigner = lazy(() => 
  import('documents/DocumentDesigner')
);
```

## Standard Worker Template

### Configuration Files

**1. `wrangler.{domain}.jsonc`**:
```json
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "irecon-{domain}-worker-staging",
  "main": "./workers/{domain}/dist/index.js",
  "compatibility_date": "2026-07-20",
  "compatibility_flags": ["nodejs_compat"],
  "workers_dev": false,
  "vars": {
    "WORKER_SHARED_SECRET": "{{ secrets.WORKER_SHARED_SECRET }}",
    "ALLOWED_ORIGINS": "http://localhost:5173,https://portal.irecon.com"
  }
}
```

**2. `workers/{domain}/package.json`**:
```json
{
  "name": "irecon-{domain}-worker",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "wrangler dev --config wrangler.{domain}.jsonc --port {port}",
    "build": "wrangler deploy --config wrangler.{domain}.jsonc --dry-run",
    "deploy": "wrangler deploy --config wrangler.{domain}.jsonc"
  },
  "dependencies": {
    // Domain-specific heavy dependencies
  },
  "devDependencies": {
    "@module-federation/vite": "^3.0.5",
    "vite": "^5.4.11",
    "wrangler": "^4.8.0"
  }
}
```

**3. `workers/{domain}/vite.config.ts`**:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import federation from "@module-federation/vite";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "{domain}",
      filename: "remoteEntry.js",
      exposes: {
        "./ComponentName": "./src/exports/ComponentName.tsx",
      },
      shared: {
        react: { singleton: true },
        "react-dom": { singleton: true },
      },
    }),
  ],
});
```

**4. `workers/{domain}/index.ts`**:
```typescript
import { Hono } from "hono";
import { cors } from "hono/cors";

export interface {Domain}WorkerEnv {
  ASSETS?: Fetcher;
  WORKER_SHARED_SECRET: string;
  ALLOWED_ORIGINS: string;
}

const app = new Hono<{ Bindings: {Domain}WorkerEnv }>();

app.use("*", 
  cors({
    origin: (origin) => {
      const allowedOrigins = (c.env.ALLOWED_ORIGINS || "").split(",");
      return allowedOrigins.includes(origin) ? origin : null;
    },
  })
);

// Health check
app.get("/health", (c) => c.json({ status: "healthy", domain: "{domain}" }));

// Federation entry point
app.get("/remoteEntry.js", async (c) => {
  // Serve from dev server or CDN
});

// Domain-specific APIs
app.post("/api/{resource}/operation", async (c) => {
  // Domain-specific business logic
});

export default { fetch: app.fetch };
```

## Success Metrics & Verification

### Technical Metrics
- **Bundle Size**: Portal bundle < 500KB (from ~1.8MB)
- **Load Time**: Cross-domain navigation < 300ms
- **Error Rate**: < 0.5% for cross-domain operations
- **Memory**: Isolated per domain, preventing cascading failures

### Business Metrics
- **Team Velocity**: Independent deployment per domain
- **User Experience**: No degradation in editor performance
- **Scalability**: Per-domain autoscaling
- **Maintainability**: Clear boundaries for debugging

## Migration Checklist for New Domains

### Phase 1: Foundation
- [ ] Create domain worker directory structure
- [ ] Configure wrangler.jsonc with domain-specific settings
- [ ] Set up package.json with isolated dependencies
- [ ] Create basic Hono API server

### Phase 2: Component Extraction
- [ ] Identify components with heavy dependencies
- [ ] Move components to domain worker
- [ ] Create federated exports
- [ ] Update portal imports to use federated components

### Phase 3: API Integration
- [ ] Identify domain-specific APIs
- [ ] Move API endpoints to domain worker
- [ ] Update portal to call domain APIs
- [ ] Implement RPC patterns

### Phase 4: Testing & Deployment
- [ ] Test cross-domain communication
- [ ] Verify bundle size reduction
- [ ] Set up CI/CD for domain worker
- [ ] Deploy to staging/production

## Current Status: Documents Domain Implementation

### ✅ Completed
- Domain worker structure created (`workers/documents/`)
- Configuration files standardized
- Documentation for standard patterns

### 🚧 In Progress
- Component migration from portal to documents worker
- Module Federation configuration
- RPC API endpoints

### 📋 Pending
- Portal integration updates
- Testing full workflow
- Performance optimization

## Future Domains Pattern

1. **Reports Domain** (`workers/reports/`)
   - Heavy dependency: `exceljs` (~1MB)
   - Components: Excel report generators, data visualizations
   - APIs: Report generation, data export

2. **Analytics Domain** (`workers/analytics/`)
   - Heavy dependencies: `recharts`, `d3`
   - Components: Dashboards, charts, data tables
   - APIs: Analytics queries, data aggregation

3. **Admin Domain** (`workers/admin/`)
   - Components: User management, system configuration
   - APIs: Settings management, audit logs

## Troubleshooting Common Issues

### Module Federation Fails to Load
1. Check domain worker is running: `curl http://localhost:${PORT}/health`
2. Verify remoteEntry.js is accessible
3. Check CORS configuration in both portal and domain worker
4. Verify shared dependencies versions match

### Cross-Domain API Calls Fail
1. Check `ALLOWED_ORIGINS` includes portal URL
2. Verify `WORKER_SHARED_SECRET` matches
3. Check API endpoint paths are correct
4. Validate request/response formats

### Performance Degradation
1. Measure bundle sizes before/after migration
2. Check network waterfall for module loading
3. Verify preloading strategies are working
4. Monitor memory usage per domain

## Conclusion

This implemented pattern establishes a scalable foundation for domain isolation. Each new domain follows the same template, ensuring consistency across the codebase while enabling teams to work independently on their domains.

**Next Step**: Complete the Documents domain implementation, then use the same pattern for Reports domain extraction.