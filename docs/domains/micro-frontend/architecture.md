# Micro Frontend Architecture: Domain-Based Module Federation

## Overview

Domain-driven micro frontend architecture using **Module Federation** to split the monolith into independently deployable domains, starting with PDF-heavy Documents domain for immediate bundle size reduction.

## Architecture Design

### Domain Structure

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

### Module Federation Layout

```
Module Federation Host: Portal Worker
├── Remote Entry: portal@remoteEntry.js
├── Shared Singletons (loaded once)
│   ├── React, React DOM
│   ├── React Router
│   └── TanStack Query
│
├── Remote Domains
│   ├── documents@remoteEntry.js  (PDFME/TiTap isolated)
│   ├── admin@remoteEntry.js      (Configuration UI)
│   └── (Future: reports, analytics, etc.)
│
└── Integration Layer
    ├── Federated Routing
    ├── Cross-Domain State Sync
    ├── Error Boundaries
    └── Performance Monitoring
```

## Dependency Strategy

### Shared Singletons (Loaded Once)

```typescript
{
  react: { singleton: true, requiredVersion: '^19.0.0' },
  'react-dom': { singleton: true, requiredVersion: '^19.0.0' },
  'react-router': { singleton: true },
  '@tanstack/react-query': { singleton: true },
  '@supabase/supabase-js': { singleton: true },
  'reui': { singleton: true },
}
```

### Isolated per Domain (Domain-Specific)

```
DOCUMENTS DOMAIN ONLY:
├── @pdfme/ui (24MB)           # PDF design library
├── @pdfme/generator           # PDF generation
├── @tiptap/core (3MB)        # Rich text editor
└── @tiptap/react             # React wrapper

FUTURE DOMAINS:
├── REPORTS: exceljs          # Excel processing
├── ANALYTICS: recharts       # Chart library
└── Each domain isolates its heavy dependencies
```

## Refactor Implementation Plan

### Phase 1: Foundation (Week 1)

```
├── Set up Module Federation infrastructure
├── Create shared dependency strategy
├── Implement cross-domain state management
├── Set up performance monitoring
└── Document current bundle baseline
```

### Phase 2: Documents Domain (Weeks 2-3)

```
├── Extract PDFME/TiTap components to Documents Worker
├── Configure Module Federation exports
├── Integrate into Portal with FederatedComponent
├── Test cross-domain communication
└── Measure bundle size reduction
```

### Phase 3: Optimization (Week 4)

```
├── Add module preloading on user intent
├── Implement request batching & caching
├── Add performance monitoring dashboard
├── Optimize cross-domain state sync
└── Implement graceful degradation
```

### Phase 4: Admin Domain (Weeks 5-6)

```
├── Extract admin/settings components
├── Implement user sync across domains
├── Test multiple domains together
└── Optimize shared state patterns
```

### Phase 5: Production Readiness (Weeks 7-10)

```
├── Advanced caching strategies
├── Canary deployment capability
├── Comprehensive monitoring & alerting
├── Automated rollback procedures
└── Team deployment tooling
```

## Performance Impact Analysis

### Current State

```
MONOLITH: 1.88MB gzipped (7.53MB uncompressed)
├── PDFME libraries: ~24MB
├── TiTap editor: ~3MB
├── ExcelJS: ~1MB
└── Remaining: ~500KB
```

### Target State (After Documents Domain Extraction)

```
MICRO FRONTENDS: ~1.7MB total (structure optimized)
├── Portal Worker: ~400KB (79% reduction)
├── Documents Worker: ~800KB (PDFME/TiTap isolated)
├── Admin Worker: ~300KB (future)
├── Shared Dependencies: ~200KB
└── TOTAL: ~1.7MB (10% net reduction)
```

### Performance Metrics

```
COLD START:
├── Monolith: ~1,200ms
├── Micro Frontends: ~700ms (42% faster)
└── Parallel loading enables faster initial paint

NAVIGATION:
├── Monolith (loaded): 50ms
├── Micro Frontends (preloaded): 100ms
├── Micro Frontends (cold): 250ms
└── With preloading: similar to monolith

MEMORY USAGE:
├── Monolith: 128MB limit (shared)
├── Micro Frontends: 165MB total (isolated)
└── Memory isolation prevents cascading failures
```

## Cross-Domain Communication Patterns

### State Synchronization

```typescript
// Event-based state sync
export class CrossDomainStateManager {
  set<T>(domain: string, key: string, value: T): void {
    // Update local state
    this.state.set(`${domain}:${key}`, value);

    // Broadcast to other domains
    this.broadcastEvent("STATE_UPDATE", { domain, key, value });
  }

  // Subscribe to cross-domain changes
  subscribe(domain: string, key: string, listener: Function) {
    return this.eventBus.on(`${domain}:${key}`, listener);
  }
}
```

### Request Batching & Caching

```typescript
// Reduce cross-domain latency
class RequestBatcher {
  private batchedRequests = new Map<string, Promise<any>>();

  async batchedFetch(domain: string, request: Request): Promise<Response> {
    const batchKey = `${domain}:${request.method}:${request.url}`;

    if (!this.batchedRequests.has(batchKey)) {
      // Create batch window
      const promise = this.createBatch(domain, request);
      this.batchedRequests.set(batchKey, promise);

      // Execute after 50ms batch window
      setTimeout(() => this.executeBatch(batchKey), 50);
    }

    return this.batchedRequests.get(batchKey)!;
  }
}
```

### Error Handling & Fallbacks

```typescript
// Circuit breaker pattern
class CircuitBreaker {
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private failures = 0;

  async execute(domain: string, request: Request): Promise<Response> {
    if (this.state === "OPEN") {
      return this.fallback(request);
    }

    try {
      const response = await fetch(request);
      this.resetFailures();
      return response;
    } catch (error) {
      this.recordFailure();
      return this.fallback(request);
    }
  }

  private fallback(request: Request): Response {
    // Show iframe fallback or degraded UI
    return new Response('<iframe src="fallback.html" />', {
      headers: { "Content-Type": "text/html" },
    });
  }
}
```

## Success Criteria

### Technical Success Metrics

```yaml
bundle_size:
  target: "< 500KB Portal bundle"
  current: "1.88MB"
  improvement: "73% reduction"

navigation_time:
  target: "< 300ms between domains"
  current: "~500ms estimated"
  baseline: "50ms monolith"

error_rate:
  target: "< 0.5% cross-domain errors"
  current: "TBD (to be measured)"
  monitoring: "Real-time dashboard"

deployment_time:
  target: "< 1 minute per domain"
  current: "~2 minutes monolith"
  automation: "Single command deploys"
```

### Business Success Metrics

```yaml
team_velocity:
  metric: "Feature delivery time"
  target: "30% improvement"
  measurement: "Jira/Linear metrics"

user_experience:
  metric: "User satisfaction score"
  target: "No degradation"
  measurement: "In-app surveys"

scalability:
  metric: "Independent scaling capability"
  target: "Per-domain autoscaling"
  measurement: "Cloudflare Worker metrics"

maintainability:
  metric: "Bug isolation effectiveness"
  target: "Domain-specific bugs contained"
  measurement: "Support ticket analysis"
```

## Risk Mitigation Strategy

### Technical Risks

1. **Cross-Domain Latency**
   - **Mitigation**: Request batching, connection pooling
   - **Fallback**: Local caching, optimistic UI updates
   - **Monitoring**: Real-time latency dashboard

2. **State Synchronization Issues**
   - **Mitigation**: Eventual consistency pattern
   - **Fallback**: Centralized KV store for critical state
   - **Monitoring**: State drift detection

3. **Module Federation Complexity**
   - **Mitigation**: Start with iframe fallback
   - **Fallback**: Progressive enhancement
   - **Training**: Team workshops, pairing sessions

### Operational Risks

1. **Deployment Coordination**
   - **Mitigation**: Automated deployment pipeline
   - **Fallback**: Rollback procedures
   - **Tooling**: Single command deploy/rollback

2. **Monitoring Fragmentation**
   - **Mitigation**: Unified observability layer
   - **Tooling**: Cross-domain trace IDs
   - **Dashboard**: Single pane of glass

3. **Team Learning Curve**
   - **Mitigation**: Incremental adoption
   - **Documentation**: Live examples, cookbook
   - **Support**: Dedicated architecture support

## Implementation Checklist

### Phase 1: Foundation

- [x] Module Federation infrastructure (`federation/` directory)
- [x] Shared dependency strategy (`federation/shared-deps.ts`)
- [x] Cross-domain state management (`federation/state/`)
- [x] Performance monitoring (`federation/monitoring/`)
- [x] Documentation consolidation

### Phase 2: Documents Domain

- [ ] Extract PDFME components to Documents Worker
- [ ] Configure Module Federation exports
- [ ] Create federated routing
- [ ] Test cross-domain communication
- [ ] Measure bundle size reduction

### Phase 3: Optimization

- [ ] Implement module preloading
- [ ] Add request batching & caching
- [ ] Create performance dashboard
- [ ] Add graceful degradation
- [ ] Set up automated rollback

## Next Steps

1. **Extract First Component**: Move `pdfme-designer.tsx` to Documents domain
2. **Test Integration**: Run Portal + Documents development servers
3. **Measure Results**: Compare bundle sizes, load times
4. **Iterate**: Optimize based on real metrics
5. **Scale**: Add Admin domain when Documents domain stable

## Conclusion

This architecture provides:

- **Immediate bundle reduction** (PDF libraries isolated)
- **Scalable foundation** for future domains
- **Team autonomy** with clear boundaries
- **Performance optimization** through parallel loading
- **Risk mitigation** through gradual rollout

The key is **starting with Documents domain** where the biggest bundle size reduction provides immediate value while establishing patterns for future expansions.
