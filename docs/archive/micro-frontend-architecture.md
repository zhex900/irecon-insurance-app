# Micro Frontend Architecture for Insurance App

## Current Bundle Analysis (2026-08-14)

**Total Bundle size:** 7.53MB uncompressed / 1.88MB gzipped

**Heavy Dependencies:**

- `@pdfme/ui` - 24MB (document designer)
- `@pdfme/converter` - 12MB (PDF conversion)
- TiTap/ProseMirror - ~3MB (rich text editor)
- ExcelJS - ~1MB (report generation)

## Proposed Worker Architecture

### Worker 1: Core Portal Worker (`wrangler.portal.jsonc`)

**Size Target:** < 500KB gzipped
**Routes:**

- `example.com/` (entry point)
- `example.com/auth/*` (login/logout)
- `example.com/dashboard`
- `example.com/policies/list`
- `example.com/clients/*`
- `example.com/policies/*` (list view only)

**Responsibilities:**

- Authentication & session management
- Navigation shell
- Core UI components
- Policy list views
- Client management

**Dependencies:**

- React Router core
- Auth libraries
- Basic UI components
- Database client

### Worker 2: Document Management Worker (`wrangler.documents.jsonc`)

**Size Target:** ~800KB gzipped (existing)
**Routes:**

- `example.com/documents/*`
- `example.com/designer/*`
- `example.com/templates/*`
- `example.com/preview/*`

**Responsibilities:**

- PDF generation & processing
- Document template designer
- Rich text editing
- PDF preview rendering

**Dependencies:**

- `@pdfme/*` libraries (all variants)
- TiTap/ProseMirror
- PDF processing libraries

### Worker 3: Admin Management Worker (`wrangler.admin.jsonc`)

**Size Target:** < 400KB gzipped
**Routes:**

- `example.com/admin/*`
- `example.com/settings/*`
- `example.com/reports/*` (admin reports)

**Responsibilities:**

- System configuration
- User management
- Audit logs
- Price configuration
- System settings

**Dependencies:**

- Data grid components
- Form libraries
- Charting libraries (light)

### Worker 4: Policy Wizard Worker (`wrangler.wizard.jsonc`)

**Size Target:** < 600KB gzipped
**Routes:**

- `example.com/policies/new/*`
- `example.com/policies/*/adjust`
- `example.com/policies/*/premium`

**Responsibilities:**

- Policy creation wizard
- Premium calculations
- Coverage configuration
- Risk assessment

**Dependencies:**

- Complex form components
- Calculation libraries
- State management

## Shared Infrastructure

### 1. Shared UI Library

```bash
shared-ui/
├── components/
│   ├── core/ (Button, Input, Modal, etc.)
│   ├── layout/ (Card, Grid, Container)
│   └── forms/ (Form components)
├── hooks/
│   ├── useAuth.ts
│   ├── useTheme.ts
│   └── useApi.ts
└── utils/
    ├── auth.ts
    ├── routing.ts
    └── validation.ts
```

**Deployment Options:**

- NPM package (versioned)
- R2-hosted bundle (CDN)
- Git submodule

### 2. Authentication Service

```typescript
// Central auth service
interface AuthService {
  // Validate sessions across Workers
  validateSession(sessionId: string): Promise<Session>;

  // Share auth state
  broadcastAuthState(state: AuthState): Promise<void>;

  // Single sign-out
  logoutAllSessions(userId: string): Promise<void>;
}
```

### 3. Cross-Worker Communication

```typescript
// Service bindings configuration
// portal-worker wrangler.toml
[[services]];
binding = "DOCUMENTS_SERVICE";
service = "documents-worker"[[services]];
binding = "ADMIN_SERVICE";
service = "admin-worker"[[services]];
binding = "WIZARD_SERVICE";
service = "wizard-worker";
```

## Routing Strategy

### Cloudflare Worker Routes

```javascript
// Cloudflare dashboard routing rules
routes = {
  "example.com/*": "portal-worker",
  "example.com/documents/*": "documents-worker",
  "example.com/designer/*": "documents-worker",
  "example.com/templates/*": "documents-worker",
  "example.com/admin/*": "admin-worker",
  "example.com/settings/*": "admin-worker",
  "example.com/policies/new/*": "wizard-worker",
  "example.com/policies/*/adjust": "wizard-worker",
};
```

### Route Coordination

```typescript
// portal-worker routes.ts
export async function handleRoute(request) {
  const url = new URL(request.url);

  if (url.pathname.startsWith("/documents/")) {
    // Forward to documents worker
    const response = await env.DOCUMENTS_SERVICE.fetch(request);
    return response;
  }

  if (url.pathname.startsWith("/admin/")) {
    // Forward to admin worker
    const response = await env.ADMIN_SERVICE.fetch(request);
    return response;
  }

  // Handle locally
  return localHandler(request);
}
```

## Implementation Phases

### Phase 1: Foundation (Week 1-2)

1. Create shared UI library
2. Extract document designer to separate Worker
3. Implement basic Worker-to-Worker communication
4. Setup cross-Worker auth

### Phase 2: Core Splitting (Week 3-4)

1. Extract admin interface to separate Worker
2. Extract policy wizard to separate Worker
3. Implement route coordination
4. Add shared state management

### Phase 3: Optimization (Week 5-6)

1. Add lazy loading between Workers
2. Implement code splitting within Workers
3. Add performance monitoring
4. Optimize bundle sizes

### Phase 4: Advanced Features (Week 7-8)

1. Add offline capabilities per Worker
2. Implement background sync
3. Add progressive web app features
4. Add advanced caching strategies

## Technical Considerations

### Bundle Size Targets

| Worker    | Current Size       | Target Size | Reduction |
| --------- | ------------------ | ----------- | --------- |
| Portal    | 1.88MB             | 500KB       | 73%       |
| Documents | Currently separate | 800KB       | -         |
| Admin     | Part of main       | 400KB       | 79%       |
| Wizard    | Part of main       | 600KB       | 68%       |
| **Total** | **1.88MB**         | **2.3MB**   | **+22%**  |

Note: Total increases slightly due to duplicated dependencies, but each Worker scales independently.

### Performance Benefits

- **Faster cold starts**: Each Worker ~300ms vs ~800ms for monolith
- **Parallel loading**: Workers load concurrently
- **Resource isolation**: Heavy operations don't block UI
- **Independent scaling**: Scale high-traffic Workers independently

### Monitoring & Observability

```yaml
# Each Worker gets independent observability
observability:
  enabled: true
  logs:
    destinations: ["sentry-logs"]
  traces:
    destinations: ["sentry-traces"]

# Tag Workers separately
tags:
  worker: "portal"
  # or
  worker: "documents"
```

## Migration Strategy

### Step 1: Parallel Deployment

1. Keep existing monolith running
2. Deploy new Workers alongside
3. Use feature flags to route traffic
4. Gradually increase traffic to new Workers

### Step 2: Data Migration

1. Share database connection via Hyperdrive
2. Use same session store across Workers
3. Maintain data consistency
4. Implement rollback strategy

### Step 3: Final Cutover

1. Route 100% traffic to new Workers
2. Monitor for issues
3. Keep monolith as fallback for 48 hours
4. Decommission monolith

## Risk Mitigation

### Potential Issues

1. **Cross-Worker latency**: Service binding overhead
2. **Session synchronization**: Race conditions
3. **Bundle duplication**: Shared libraries across Workers
4. **Complex debugging**: Multiple Worker logs

### Mitigation Strategies

1. **Benchmark latency**: Measure service binding overhead
2. **Centralized session store**: Single source of truth
3. **Shared UI library**: Reduce duplication
4. **Unified logging**: Correlate logs across Workers
5. **Comprehensive testing**: E2E tests across Workers

## Success Metrics

### Primary Metrics

- **Cold start time**: Target < 300ms per Worker
- **Bundle size**: Each Worker < 1MB gzipped
- **Page load time**: Target < 1s for non-document pages
- **Memory usage**: Each Worker < 128MB

### Secondary Metrics

- **Deployment speed**: Target < 2 minutes per Worker
- **Error rate**: Target < 0.1% per Worker
- **Developer experience**: Impact on development workflow

## Next Steps

### Immediate Actions (Next 7 days)

1. ✅ Analyze current bundle (Complete)
2. ✅ Design architecture (Complete)
3. Create proof-of-concept for document Worker extraction
4. Begin shared UI library development
5. Setup cross-Worker auth prototype

### Week 2 Goals

1. Complete document Worker extraction
2. Deploy first micro frontend to staging
3. Measure performance impact
4. Gather team feedback

### Success Criteria

- Document Worker runs independently
- Core portal bundle reduced by 50%
- No regression in user experience
- Development team can work on isolated Workers
