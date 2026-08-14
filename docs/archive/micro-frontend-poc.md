# Micro Frontend Proof of Concept

## Phase 1: Extract Document Designer to Separate Worker

### Current Structure

- Main app: Contains document designer UI
- Document Worker: PDF generation service only
- Need: Full document designer UI as separate Worker

### Implementation Steps

#### 1. Create Document Designer Worker

```bash
mkdir -p workers/documents-ui
cd workers/documents-ui
```

**wrangler.documents-ui.jsonc:**

```json
{
  "$schema": "../node_modules/wrangler/config-schema.json",
  "name": "insurance-documents-ui-staging",
  "main": "./index.ts",
  "compatibility_date": "2026-07-20",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {
    "enabled": true,
    "logs": {
      "enabled": true,
      "head_sampling_rate": 1,
      "destinations": ["sentry-logs"]
    },
    "traces": {
      "enabled": true,
      "head_sampling_rate": 1,
      "destinations": ["sentry-traces"]
    }
  },
  "assets": {
    "directory": "../../public/fonts",
    "binding": "ASSETS",
    "run_worker_first": true
  },
  "vars": {
    "APP_URL": "https://insurance.example.com",
    "MAIN_WORKER_URL": "https://portal-staging.example.com"
  }
}
```

#### 2. Extract Document Designer Components

Files to extract:

- `app/components/documents/pdfme-designer.tsx`
- `app/components/documents/pdfme-designer-helpers.ts`
- `app/components/documents/pdfme-designer-selection-toolbar.tsx`
- `app/components/documents/document-template-editor.tsx`
- `app/components/documents/document-template-editor-header.tsx`
- `app/components/documents/document-template-editor-toolbar.tsx`

Dependencies to extract:

- All `@pdfme/*` dependencies
- `@tiptap/*` dependencies
- Related hooks and utilities

#### 3. Create Shared Bridge Component

```typescript
// Main app: DocumentDesignerBridge.tsx
export function DocumentDesignerBridge({ templateId }: { templateId: string }) {
  const [isLoaded, setIsLoaded] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    // Post message to initialize
    iframe.onload = () => {
      iframe.contentWindow?.postMessage({
        type: 'INIT_DESIGNER',
        templateId,
        sessionToken: getSessionToken()
      }, 'https://documents-ui.example.com');
      setIsLoaded(true);
    };

    // Listen for messages
    const handleMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://documents-ui.example.com') return;

      switch (event.data.type) {
        case 'DESIGNER_READY':
          console.log('Designer loaded');
          break;
        case 'DESIGNER_SAVED':
          // Notify main app of save
          onTemplateSaved(event.data.template);
          break;
        case 'DESIGNER_ERROR':
          console.error('Designer error:', event.data.error);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [templateId]);

  return (
    <iframe
      ref={iframeRef}
      src="https://documents-ui.example.com/designer"
      className="w-full h-[800px] border-0"
      title="Document Designer"
    />
  );
}
```

#### 4. Route Coordination

**Main Worker:**

```typescript
// Main Worker routes.ts
export async function handleDocumentRoutes(request: Request, env: Env) {
  const url = new URL(request.url);

  // Forward document designer routes to document UI Worker
  if (
    url.pathname.startsWith("/documents/designer") ||
    url.pathname.startsWith("/templates/edit/")
  ) {
    // Forward request with headers
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.set("X-Forwarded-From", "main-worker");

    const forwardRequest = new Request(
      `https://documents-ui.example.com${url.pathname}`,
      {
        method: request.method,
        headers: forwardHeaders,
        body: request.body,
      },
    );

    return env.DOCUMENTS_UI_SERVICE.fetch(forwardRequest);
  }

  // Handle all other routes locally
  return localHandler(request);
}
```

#### 5. Shared Authentication

```typescript
// Shared auth across Workers
export async function verifySessionAcrossWorkers(
  request: Request,
  env: Env,
): Promise<Session | null> {
  // Try to get session from main auth service
  const sessionId = getSessionIdFromRequest(request);
  if (!sessionId) return null;

  // Check if we're in a subdomain context
  if (request.url.includes("documents-ui.example.com")) {
    // Validate session with main Worker
    const validationResponse = await fetch(
      `https://portal.example.com/api/auth/verify`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionId}`,
        },
      },
    );

    if (validationResponse.ok) {
      return await validationResponse.json();
    }
  }

  return null;
}
```

### Phase 2: Extract Admin Interface

#### Files to Extract

- `app/routes/_app/settings/*`
- `app/routes/_app/admin/*`
- `app/routes/api/admin/*`
- Related admin components

#### Worker Configuration

**wrangler.admin.jsonc:**

```json
{
  "name": "insurance-admin-ui-staging",
  "main": "./index.ts",
  "compatibility_date": "2026-07-20",
  "compatibility_flags": ["nodejs_compat"],
  "observability": {/* ... */},
  "vars": {
    "APP_URL": "https://insurance.example.com",
    "MAIN_WORKER_URL": "https://portal-staging.example.com",
    "DOCUMENTS_UI_URL": "https://documents-ui.example.com"
  }
}
```

### Phase 3: Shared UI Library

#### Structure

```bash
shared-ui/
├── package.json
├── tsconfig.json
├── src/
│   ├── components/
│   │   ├── Button.tsx
│   │   ├── Input.tsx
│   │   ├── Card.tsx
│   │   └── Modal.tsx
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   └── useApi.ts
│   └── utils/
│       ├── auth.ts
│       └── routing.ts
└── dist/
```

#### Build Configuration

```json
{
  "name": "@insurance/shared-ui",
  "version": "1.0.0",
  "type": "module",
  "exports": {
    ".": "./dist/index.js",
    "./components": "./dist/components/index.js",
    "./hooks": "./dist/hooks/index.js"
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc && vite build",
    "dev": "vite build --watch"
  }
}
```

### Phase 4: Performance Monitoring

#### Bundle Size Tracking

```bash
# Script to track bundle sizes
#!/bin/bash
echo "=== Worker Bundle Sizes ==="
echo "Main Worker:"
npx wrangler deploy --config wrangler.jsonc --dry-run 2>&1 | grep "gzip"

echo "Documents UI Worker:"
npx wrangler deploy --config wrangler.documents-ui.jsonc --dry-run 2>&1 | grep "gzip"

echo "Admin Worker:"
npx wrangler deploy --config wrangler.admin.jsonc --dry-run 2>&1 | grep "gzip"
```

### Testing Strategy

#### 1. Integration Tests

```typescript
// Test cross-Worker communication
test("Document designer loads in iframe", async () => {
  const response = await fetch(
    "https://documents-ui.example.com/designer?template=123",
  );
  expect(response.status).toBe(200);

  // Check that iframe gets correct session
  const page = await playwrightPage();
  await page.goto("https://portal.example.com/templates/123");

  const iframe = page.frameLocator("iframe");
  await expect(iframe.locator(".designer-toolbar")).toBeVisible();
});

// Test shared auth
test("Session persists across Workers", async () => {
  // Login in main Worker
  await api.login("user@example.com", "password");

  // Navigate to document designer
  await page.goto("https://documents-ui.example.com/designer");

  // Should be authenticated
  const userInfo = await page.textContent(".user-avatar");
  expect(userInfo).toContain("user@example.com");
});
```

#### 2. Performance Tests

```typescript
test("Cold start comparison", async () => {
  // Main Worker cold start
  const mainStart = Date.now();
  await fetch("https://portal.example.com/");
  const mainTime = Date.now() - mainStart;

  // Document UI Worker cold start
  const docStart = Date.now();
  await fetch("https://documents-ui.example.com/designer");
  const docTime = Date.now() - docStart;

  console.log(`Main: ${mainTime}ms, Docs: ${docTime}ms`);
  expect(docTime).toBeLessThan(mainTime * 0.7);
});
```

### Migration Checklist

#### Pre-Migration

- [ ] Backup current production
- [ ] Create rollback plan
- [ ] Set up staging environment
- [ ] Configure monitoring
- [ ] Train team on new architecture

#### During Migration

- [ ] Deploy document UI Worker to staging
- [ ] Test integration with main Worker
- [ ] Verify authentication flow
- [ ] Test performance impact
- [ ] Gather user feedback

#### Post-Migration

- [ ] Monitor error rates
- [ ] Track performance metrics
- [ ] Gather team feedback
- [ ] Document lessons learned
- [ ] Plan next extraction phase

### Success Criteria

#### Technical Success

- Document UI Worker bundle size < 1MB gzipped
- Main Worker bundle reduced by > 50%
- Cross-Worker auth works seamlessly
- No regression in user experience
- Cold start time < 300ms per Worker

#### Business Success

- Development team can work independently
- Deployments are faster
- Scaling is more cost-effective
- Maintainability improved
- Team satisfaction increased

#### Risk Mitigation

- Feature flags for gradual rollout
- Comprehensive monitoring
- Automated rollback procedures
- User feedback collection
- Regular health checks

### Next Steps

1. **Week 1-2**: Extract document designer UI
2. **Week 3-4**: Implement cross-Worker auth
3. **Week 5-6**: Create shared UI library
4. **Week 7-8**: Extract admin interface
5. **Week 9-10**: Performance optimization
6. **Week 11-12**: Production rollout
