# Micro Frontend Architecture Decisions Guide

## For: Insurance App Bundle Optimization

## Current Context Analysis

**Your goals**:

1. Reduce bundle size (currently 1.88MB gzipped)
2. Scale independently (PDF heavy vs admin light)
3. Maintain team velocity
4. Keep user experience smooth

**Your constraints**:

- Cloudflare Workers environment
- Existing monolith with React Router
- PDFME/ProseMirror large dependencies
- Team familiar with current stack

## Critical Decisions Checklist

### 📍 Decision 1: Start Small vs Go All In

**Option A**: Extract Documents Worker only (recommended)

```typescript
// Start with biggest pain point
- Extract: Document designer UI + PDF libraries
- Keep: Everything else in monolith
- Test: Cross-Worker communication patterns
- Validate: Performance improvements
```

**Option B**: Full micro frontend rollout

```typescript
// Higher risk, bigger payoff
- Extract: Documents, Admin, Portal separately
- Build: Complete cross-Worker infrastructure
- Deploy: All at once
- Risk: Everything breaks at once
```

**✅ Recommendation**: **Option A - Documents Worker only**

- **Rationale**: 80% of bundle size reduction from PDF libraries alone
- **Risk**: Contained to document functionality
- **Learning**: Establish patterns before scaling

### 📍 Decision 2: UI Integration Pattern

**Option A**: Iframe embedding (start here)

```typescript
// Pros: Simple, isolated, no React version conflicts
// Cons: Limited interactivity, loading states
<iframe src="https://documents.example.com/designer/123" />
```

**Option B**: Module Federation (eventual goal)

```typescript
// Pros: Seamless, native React components
// Cons: Complex build setup, version coupling
import("documents/designer").then(Designer => {
  return <Designer templateId="123" />;
});
```

**Option C**: Custom Elements (lightweight alternative)

```typescript
// Pros: Framework agnostic, simple
// Cons: Limited React integration
<document-designer template-id="123"></document-designer>
```

**✅ Recommendation**: **Start with A, plan for B**

- **Phase 1**: Iframe for quick extraction
- **Phase 2**: Add better loading states
- **Phase 3**: Migrate to Module Federation when stable

### 📍 Decision 3: Authentication Flow

**Option A**: Central auth proxy (simplest)

```typescript
// All requests flow through Portal Worker
// Portal validates → forwards to Documents Worker
app.get("/documents/*", async (req) => {
  const session = await validateSession(req);
  if (!session) return new Response("Unauthorized", { status: 401 });

  // Forward with signed token
  return forwardToDocumentsWorker(req, session);
});
```

**Option B**: Shared JWT tokens

```typescript
// Portal signs tokens → Documents validates
// Stateless but token management complexity
app.post("/login", (req) => {
  const token = signJWT(userId, ["documents:read"]);
  return { token };
});

// Documents Worker validates independently
app.get("/designer", (req) => {
  const token = validateJWT(req.headers.authorization);
  if (!token) return new Response("Unauthorized", { status: 401 });
});
```

**Option C**: Cloudflare Service Bindings only

```typescript
// Workers communicate directly via bindings
// Browser only talks to Portal Worker
// Most secure, most Cloudflare-native
```

**✅ Recommendation**: **Option C + Light A**

- **Primary**: Service bindings for Worker-to-Worker
- **Fallback**: Token validation for direct browser access
- **Edge**: CDN authentication if needed later

### 📍 Decision 4: Data Ownership Boundaries

**Critical question**: "Who owns the template data?"

**Option A**: Documents Worker owns everything

```typescript
// Pros: Clean separation, Documents controls schema
// Cons: Portal can't show template lists without API calls
// Users -> Portal -> List templates -> Documents API -> Render list
```

**Option B**: Portal owns metadata, Documents owns content

```typescript
// Pros: Portal can render lists fast
// Cons: Sync complexity (who updates lastModified?)
// Portal DB: { id, name, lastModified }
// Documents Worker: { id, content, schema }
```

**Option C**: Shared database (current monolith pattern)

```typescript
// Pros: Simple, no sync needed
// Cons: Coupling, can't evolve schemas independently
// Both Workers query same Supabase tables
```

**✅ Recommendation**: **Option B - Split ownership**

- **Portal**: Owns `id, name, author, createdAt, updatedAt`
- **Documents**: Owns `content, schema, versions, previews`
- **Sync**: Event-based (Portal emits `templateUpdated`)

### 📍 Decision 5: State Synchronization Strategy

**Between Portal (list view) and Documents (editor)**:

```typescript
// User edits template name in Documents Worker
// Portal list view needs to update

// Option A: Polling (simplest)
setInterval(() => {
  fetchLatestTemplates();
}, 30000); // Every 30 seconds

// Option B: WebSockets/Server-Sent Events
// Real-time but connection management

// Option C: Background sync
// Documents Worker POSTs updates to Portal API
// Portal updates cache, eventual consistency

// Option D: Shared KV store
// Both Workers read/write to same KV namespace
// Atomic operations but Cloudflare-specific
```

**✅ Recommendation**: **Option D + C**

- **Primary**: Cloudflare KV for shared state (fast, atomic)
- **Fallback**: Background API sync for complex operations
- **UX**: Optimistic updates (update UI immediately)

### 📍 Decision 6: Error Handling Strategy

**When Documents Worker fails...**

**Option A**: Graceful degradation in Portal

```typescript
// Show "Designer unavailable" with fallback form
function DocumentEditorFallback() {
  if (documentsWorkerDown) {
    return <BasicTextEditor />; // Simple HTML form
  }
  return <DocumentDesignerIframe />;
}
```

**Option B**: Circuit breaker pattern

```typescript
// Stop trying Documents Worker after N failures
class CircuitBreaker {
  constructor(private worker) {
    this.state = "CLOSED";
  }

  async execute(request) {
    if (this.state === "OPEN") {
      return this.fallback(request);
    }

    try {
      const result = await this.worker.fetch(request);
      this.success();
      return result;
    } catch (error) {
      this.failure();
      return this.fallback(request);
    }
  }
}
```

**Option C**: User-controlled failover

```typescript
// "Try basic editor" button appears when fancy fails
<DocumentDesigner
  onError={() => setShowBasicEditor(true)}
/>

{showBasicEditor && <BasicTextEditor />}
```

**✅ Recommendation**: **Option B + A**

- **Automatic**: Circuit breaker with 5 failures → fallback
- **Manual**: User can explicitly choose basic editor
- **Monitoring**: Alert when circuit breaker trips

### 📍 Decision 7: Performance Monitoring

**What to measure when separating Workers**:

**Option A**: End-to-end user metrics (most important)

```typescript
// Measure real user experience
const metrics = {
  documentDesignerLoadTime: "1.2s", // Target: < 2s
  navigationBetweenWorkers: "350ms", // Target: < 500ms
  crossWorkerAuthLatency: "45ms", // Target: < 100ms
  errorRate: "0.5%", // Target: < 1%
};
```

**Option B**: Individual Worker metrics

```typescript
// Per-Worker Cloudflare metrics
const workerMetrics = {
  portal: { requests: 1000, errors: 5, cpuTime: "45ms" },
  documents: { requests: 200, errors: 2, cpuTime: "120ms" },
};
```

**Option C**: Business metrics

```typescript
// Impact on user behavior
const businessMetrics = {
  templatesCreated: "+15%", // Did extraction help?
  userSatisfaction: "4.5/5", // Surveys
  supportTickets: "-20%", // Fewer PDF issues?
};
```

**✅ Recommendation**: **All three**

- **Primary**: Option A (user experience first)
- **Secondary**: Option B (debug operational issues)
- **Tertiary**: Option C (validate business value)

## Prioritized Implementation Sequence

### Phase 1: Foundation (Week 1-2)

```bash
# MUST decisions before starting:
1. ✅ Choose iframe integration (simple start)
2. ✅ Use path-based routing (example.com/documents/*)
3. ✅ Implement circuit breaker error handling
4. ✅ Set up cross-Worker metrics collection
5. ✅ Create rollback procedure

# Build order:
1. Cross-Worker communication layer
2. Authentication with service bindings
3. Basic iframe integration
4. Performance monitoring dashboard
5. Automated deployment scripts
```

### Phase 2: Extract Documents Worker (Week 3-4)

```bash
# Extract PDF-heavy components:
1. pdfme-designer.tsx + all PDFME imports
2. document-template-editor.tsx
3. Related hooks (use-pdfme-designer-lifecycle.ts)
4. Template preview functionality
5. PDF generation service (keep in separate Worker)

# Keep in Portal Worker:
1. Template list views
2. User permissions checking
3. Navigation/shell
4. Everything else
```

### Phase 3: Optimize (Week 5-6)

```bash
# After Documents Worker works:
1. Add Worker warming (preload on hover)
2. Implement request batching
3. Add KV-based shared state
4. Optimize iframe loading transitions
5. Add canary deployment capability
```

### Phase 4: Expand (Week 7-8)

```bash
# Only if Phase 3 successful:
1. Extract Admin UI Worker next
2. Implement Module Federation
3. Add advanced caching strategies
4. Build team deployment tooling
5. Document patterns for future Workers
```

## Risk Mitigation Plan

### Red Flags (Stop and reconsider)

```typescript
const RED_FLAGS = {
  // Performance
  navigationSlowerThan500ms: true, // Target missed
  bundleSizeNotReduced: true, // Why bother?
  crossWorkerLatencyOver100ms: true, // Unacceptable

  // Operational
  deploymentTakesOver10Minutes: true,
  errorRateOver2Percent: true,
  rollbackTakesOver5Minutes: true,

  // Developer Experience
  localDevelopmentBroken: true,
  testSuiteFailing: true,
  teamResistanceHigh: true,
};
```

### Rollback Triggers

```bash
# Immediately rollback if:
1. User reports > 5% error rate increase
2. Performance degradation > 30%
3. Critical business flow broken
4. Security vulnerability introduced
5. Team cannot debug cross-Worker issues

# Rollback procedure:
./scripts/rollback-microfrontends.sh --reason "$REASON"
```

## Final Recommendation Summary

### For Your First Micro Frontend:

**Do**: Extract Documents Worker only  
**Integration**: Iframe with smooth loading  
**Auth**: Service bindings + cookie fallback  
**State**: KV store + optimistic updates  
**Routing**: Path-based (`example.com/documents/*`)  
**Monitoring**: E2E user metrics dashboard

### Don't Do Yet:

- Don't extract Admin Worker (yet)
- Don't implement Module Federation (yet)
- Don't change auth flow (keep current Supabase)
- Don't rewrite all error handling
- Don't optimize prematurely

### Success Criteria:

1. Bundle size reduction > 50% achieved
2. User navigation < 500ms maintained
3. Cross-Worker errors < 1%
4. Team can deploy independently
5. Rollback takes < 2 minutes

## Next Immediate Steps

1. **Discuss with team**: Share this decision guide
2. **Set up metrics**: Implement monitoring before extraction
3. **Build foundation**: Cross-Worker communication layer
4. **Extract first component**: pdfme-designer.tsx to iframe
5. **Measure results**: Compare before/after metrics

The key is **start small, measure everything, iterate based on data**. Extract the Documents Worker, measure the impact, and only then decide on extracting more.
