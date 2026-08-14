# Refactor Plan: Phase-by-Phase Implementation

## Overview

Step-by-step guide to refactor from monolith to domain-based micro frontends using Module Federation.

## Phase 0: Preparation (Week 1)

### Step 1: Current State Analysis

```bash
# 1. Measure current bundle size
./scripts/analyze-bundle.sh

# 2. Identify heavy dependencies
grep -r "@pdfme" app/ --include="*.tsx" --include="*.ts" | wc -l
grep -r "@tiptap" app/ --include="*.tsx" --include="*.ts" | wc -l
grep -r "exceljs" app/ --include="*.tsx" --include="*.ts" | wc -l

# 3. Document component dependencies
docs/current-state-analysis.md
```

### Step 2: Module Federation Foundation

```bash
# 1. Install dependencies
npm install @module-federation/vite @module-federation/runtime

# 2. Create core infrastructure
mkdir -p federation/{loader,state,monitoring}

# 3. Configure shared dependencies
federation/shared-deps.ts

# Complete by end of Week 1:
✅ Module Federation infrastructure ready
✅ Shared dependency strategy defined
✅ Error handling framework complete
✅ Performance monitoring established
```

## Phase 1: Documents Domain Extraction (Week 2-3)

### Step 1: Create Documents Worker

```bash
# Create Documents domain structure
workers/documents/
├── package.json                    # Own dependencies
├── vite.config.ts                 # Module Federation config
├── src/components/DocumentDesigner.tsx
├── src/hooks/use-federation.ts
└── src/exports.ts

# Set up dependencies
cd workers/documents
npm install @pdfme/ui @tiptap/core
```

### Step 2: Extract PDFME Components

```bash
# Move PDF-heavy components to Documents domain
mv app/components/documents/pdfme-designer.tsx workers/documents/src/components/
mv app/hooks/use-pdfme-designer-lifecycle.ts workers/documents/src/hooks/
mv app/components/documents/pdfme-designer-helpers.ts workers/documents/src/utils/

# Keep lightweight components in Portal
# app/components/documents/document-template-list.tsx (stays in Portal)
# app/routes/documents/ (routing stays in Portal)
```

### Step 3: Module Federation Integration

```typescript
// Portal Worker: Update Vite config
// vite.config.federation.ts
federation({
  name: "portal",
  remotes: {
    documents: "documents@https://documents.example.com/remoteEntry.js",
  },
});

// Documents Worker: Configure exports
// workers/documents/vite.config.ts
federation({
  name: "documents",
  exposes: {
    "./DocumentDesigner": "./src/exports.ts",
    "./PDFPreview": "./src/exports.ts",
  },
});
```

### Step 4: Update Portal Integration

```typescript
// Replace direct imports with federated components
// BEFORE:
import { DocumentDesigner } from '~/components/documents/pdfme-designer';

// AFTER:
import { FederatedComponent } from '~/federation/loader';

<FederatedComponent
  domain="documents"
  module="DocumentDesigner"
  templateId={templateId}
  fallback={<DesignerSkeleton />}
/>
```

### Step 5: Test Integration

```bash
# Start development servers
cd workers/documents && npm run dev    # Port 5174
cd ../.. && npm run dev:federation    # Port 5173

# Test navigation
# 1. Open Portal app
# 2. Navigate to document designer
# 3. Verify PDFME loads from Documents domain
# 4. Check console for federation metrics
```

### Complete by end of Week 3:

✅ Documents domain extraction complete
✅ Module Federation integration working
✅ Cross-domain communication tested
✅ Performance baseline established

## Phase 2: Optimization (Week 4)

### Step 1: Performance Optimization

```typescript
// 1. Module preloading
useEffect(() => {
  // Preload Documents on hover
  const link = document.querySelector('[href*="documents"]');
  link?.addEventListener("mouseenter", () => {
    import("documents/remoteEntry.js");
  });
}, []);

// 2. Request batching
class RequestBatcher {
  async batchedFetch(domain: string, request: Request) {
    // Batch requests within 50ms window
  }
}

// 3. Caching strategy
class FederationCache {
  async getOrLoad(key: string, loader: Function) {
    // Cache with TTL
  }
}
```

### Step 2: Monitoring Dashboard

```typescript
// Create real-time monitoring dashboard
// app/components/dashboard/FederationMetrics.tsx

export function FederationMetrics() {
  const [metrics, setMetrics] = useState({
    moduleLoadTimes: [],
    crossDomainCalls: [],
    errorRates: [],
  });

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      fetch('/api/federation-metrics').then(setMetrics);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  return <MetricsDashboard metrics={metrics} />;
}
```

### Step 3: Error Recovery

```typescript
// 1. Circuit breaker pattern
class CircuitBreaker {
  private state = 'CLOSED';
  private failures = 0;

  async execute(request: Request): Promise<Response> {
    if (this.state === 'OPEN') {
      return this.fallback(request);
    }

    try {
      return await fetch(request);
    } catch (error) {
      this.recordFailure();
      return this.fallback(request);
    }
  }
}

// 2. Iframe fallback for critical failures
function IframeFallback({ domain, path }: { domain: string; path: string }) {
  return (
    <iframe
      src={`https://${domain}.example.com${path}`}
      className="w-full h-full border-0"
    />
  );
}
```

### Complete by end of Week 4:

✅ Performance optimizations implemented
✅ Monitoring dashboard operational
✅ Error recovery mechanisms tested
✅ Team trained on new patterns

## Phase 3: Admin Domain Extraction (Week 5-6)

### Step 1: Create Admin Worker

```bash
# Pattern from Documents domain
workers/admin/
├── package.json                    # Admin-specific dependencies
├── vite.config.ts                 # Module Federation config
├── src/components/UserManagement.tsx
├── src/components/SettingsDashboard.tsx
└── src/exports.ts

# Add to Portal Federation config
remotes: {
  documents: 'documents@https://documents.example.com/remoteEntry.js',
  admin: 'admin@https://admin.example.com/remoteEntry.js',
}
```

### Step 2: Extract Admin Components

```bash
# Move settings components
mv app/components/settings/ workers/admin/src/components/
mv app/routes/_app/settings/ workers/admin/src/routes/

# Update Portal routing
{
  path: 'admin/*',
  lazy: () => import('./routes/federated-admin'),
}
```

### Step 3: Cross-Domain State Synchronization

```typescript
// User permissions sync across domains
async function syncUserPermissions(userId: string, permissions: string[]) {
  // Update in all domains
  await Promise.all([
    portalAPI.updateUser(userId, permissions),
    documentsAPI.syncUserPermissions(userId, permissions),
    adminAPI.syncUserPermissions(userId, permissions),
  ]);
}

// Template metadata sync
async function syncTemplateUpdate(templateId: string, metadata: any) {
  // Portal needs list view updates
  portalState.set(`templates:${templateId}`, metadata);

  // Documents already has the update
  // Admin may need audit log
  adminAPI.logTemplateUpdate(templateId, metadata);
}
```

### Step 4: Test Multi-Domain Integration

```typescript
// Test scenarios:
// 1. User navigates Portal → Documents → Admin → Portal
// 2. State sync across all domains
// 3. Concurrent module loading
// 4. Error recovery with multiple domains
```

### Complete by end of Week 6:

��� Admin domain extraction complete
✅ Multi-domain communication tested
✅ State synchronization working
✅ Performance with multiple domains optimized

## Phase 4: Production Readiness (Week 7-10)

### Step 1: Advanced Caching

```typescript
// Cross-domain shared cache
class CrossDomainCache {
  private cache = new Map<string, CacheEntry>();

  async getOrCompute(
    key: string,
    domain: string,
    compute: Function,
    ttl: number,
  ) {
    // Cache with domain awareness
    // Invalidate across domains
    // Handle cache versioning
  }
}
```

### Step 2: Canary Deployments

```bash
# Deployment strategy
# 1. Deploy to staging with feature flags
# 2. Enable for 1% of users
# 3. Monitor performance metrics
# 4. Gradually increase to 100%

./scripts/deploy-canary.sh \
  --domain documents \
  --version v1.2.0 \
  --percentage 10 \
  --metrics-dashboard
```

### Step 3: Comprehensive Monitoring

```typescript
// Real-time alerting
class FederationAlerts {
  static checkThresholds(metrics: Metrics) {
    if (metrics.errorRate > 0.05) {
      this.alert("High error rate detected");
    }

    if (metrics.avgLoadTime > 1000) {
      this.alert("Slow module loading detected");
    }
  }
}

// Automated rollback triggers
const ROLLBACK_TRIGGERS = {
  errorRate: 0.05, // 5% errors triggers rollback
  loadTime: 2000, // 2s average load time
  memoryUsage: 0.8, // 80% memory usage
};
```

### Step 4: Team Tooling & Documentation

```bash
# Create deployment tools
scripts/
├── deploy-all.sh            # Deploy all domains
├── rollback-domain.sh       # Rollback specific domain
├── health-check.sh          # Check all domains
└── performance-test.sh     # Run performance tests

# Update documentation
docs/microfrontend-consolidated/
├── COOKBOOK.md             # Common patterns & solutions
├── TROUBLESHOOTING.md      # Debugging guide
└── API-REFERENCE.md       # Federation APIs
```

### Complete by end of Week 10:

✅ Advanced caching strategies implemented
✅ Canary deployment capability ready
✅ Comprehensive monitoring & alerting
✅ Team tooling & documentation complete

## Success Verification Checklist

### Phase 1 Verification (Documents Domain)

```yaml
- [ ] Bundle size reduction achieved (>50% Portal reduction)
- [ ] Navigation between domains < 300ms
- [ ] Cross-domain errors < 0.5%
- [ ] Team can deploy Documents independently
- [ ] Rollback procedure tested and works
```

### Phase 2 Verification (Optimization)

```yaml
- [ ] Module preloading reduces perceived load time
- [ ] Request batching reduces cross-domain calls
- [ ] Monitoring dashboard provides actionable insights
- [ ] Error recovery mechanisms work as expected
- [ ] User experience matches or exceeds monolith
```

### Phase 3 Verification (Admin Domain)

```yaml
- [ ] Admin domain extracted and working
- [ ] Cross-domain state sync functions correctly
- [ ] Multiple domains can run concurrently
- [ ] Performance with multiple domains acceptable
- [ ] Team productivity improved
```

### Phase 4 Verification (Production)

```yaml
- [ ] Canary deployments work flawlessly
- [ ] Automated rollback triggers fire correctly
- [ ] Monitoring catches issues before users
- [ ] Team velocity shows measurable improvement
- [ ] User satisfaction maintained or improved
```

## Risk Mitigation Actions

### At Each Phase Gate:

1. **Performance regression** → Rollback & investigate
2. **User complaints** → Feature flag off, fix issue
3. **Team productivity drop** → Additional training, process adjustment
4. **Deployment failures** → Automated rollback, fix CI/CD

### Fallback Strategies:

1. **Module Federation fails** → Iframe fallback
2. **Cross-domain communication fails** → Local caching
3. **State sync fails** → Manual sync button for users
4. **Performance degrades** → Progressive enhancement

## Timeline & Milestones

### Week 1-2: Foundation & Documents Extraction

```bash
# Milestone: Documents domain extraction complete
# Deliverable: Bundle size reduction report
# Verification: Navigation performance metrics
```

### Week 3-4: Optimization & Monitoring

```bash
# Milestone: Performance optimization complete
# Deliverable: Monitoring dashboard
# Verification: Error rate under 0.5%
```

### Week 5-6: Admin Domain & Multi-Domain

```bash
# Milestone: Multi-domain architecture working
# Deliverable: Cross-domain state sync
# Verification: Team deployment independence
```

### Week 7-10: Production Readiness

```bash
# Milestone: Production deployment capability
# Deliverable: Canary deployment pipeline
# Verification: Automated rollback procedures
```

## Team Roles & Responsibilities

### Architecture Team

- Design Module Federation implementation
- Establish shared dependency strategy
- Create monitoring & metrics framework
- Implement rollback procedures

### Documents Domain Team (Primary)

- Extract PDFME/TiTap components
- Implement DocumentDesigner federation
- Set cross-domain communication patterns
- Test with real users

### DevOps Team

- Create deployment automation
- Set up monitoring dashboards
- Implement canary deployment
- Establish CI/CD pipelines

### QA Team

- Test cross-domain scenarios
- Validate performance metrics
- Test error recovery mechanisms
- Verify user experience

## Getting Started

### Immediate Next Steps:

```bash
# 1. Review architecture documentation
docs/microfrontend-consolidated/ARCHITECTURE.md

# 2. Set up Module Federation foundation
npm install @module-federation/vite
cp federation/* src/federation/

# 3. Extract first component
mv app/components/documents/pdfme-designer.tsx workers/documents/src/components/

# 4. Test integration
npm run dev:federation
```

### Quick Validation:

```typescript
// Test Module Federation setup
import { FederatedComponent } from '~/federation/loader';

function TestFederation() {
  return (
    <FederatedComponent
      domain="documents"
      module="DocumentDesigner"
      templateId="test"
      fallback={<div>Loading...</div>}
    />
  );
}
```

The key to success is **incremental delivery**: Start with Documents domain, prove the value, then expand based on data-driven decisions.
