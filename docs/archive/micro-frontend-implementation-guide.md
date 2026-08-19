# Micro Frontend Implementation Guide

## Deployment Steps

### Phase 1: Setup Infrastructure

#### 1. Create Worker Namespaces

```bash
# Deploy document UI Worker
cd /Users/jake/Code/irecon-insurance-app/workers/documents-ui
npx wrangler deploy --config wrangler.documents-ui.jsonc

# Deploy admin UI Worker
cd /Users/jake/Code/irecon-insurance-app/workers/admin-ui
npx wrangler deploy --config wrangler.admin.jsonc

# Update main Worker with service bindings
cd /Users/jake/Code/irecon-insurance-app
npx wrangler deploy --config wrangler.expanded.jsonc
```

#### 2. Configure Cloudflare Routes

```bash
# In Cloudflare dashboard:
# 1. Add custom domain for document UI Worker
# 2. Add custom domain for admin UI Worker
# 3. Update DNS records
# 4. Configure Worker routes

# Example DNS records:
documents-ui.example.com → documents-ui-worker
admin-ui.example.com → admin-ui-worker
portal.example.com → main-worker
```

#### 3. Setup Environment Variables

```bash
# .env file
VITE_DOCUMENTS_WORKER_URL=https://documents-ui.example.com
VITE_ADMIN_WORKER_URL=https://admin-ui.example.com
VITE_MAIN_WORKER_URL=https://portal.example.com

# wrangler.jsonc variables
"vars": {
  "DOCUMENTS_UI_URL": "https://documents-ui.example.com",
  "ADMIN_UI_URL": "https://admin-ui.example.com",
  "APP_URL": "https://example.com"
}
```

### Phase 2: Extract Document Designer

#### 1. Identify Components to Extract

```bash
# Find all document designer components
grep -r "@pdfme\|@tiptap" app/components/ --include="*.tsx" --include="*.ts"

# Components to move:
- app/components/documents/pdfme-designer.tsx
- app/components/documents/pdfme-designer-helpers.ts
- app/components/documents/document-template-editor.tsx
- app/components/documents/document-template-editor-header.tsx
- app/components/documents/document-template-editor-toolbar.tsx
- app/hooks/use-pdfme-designer-actions.ts
- app/hooks/use-pdfme-designer-lifecycle.ts
- app/hooks/use-document-template-editor-controller.ts
```

#### 2. Update Main App

```typescript
// Replace direct imports with bridge components
// app/routes/_app/settings/document-templates.$templateKey.tsx

import { DocumentDesignerBridge } from "~/components/documents/DocumentDesignerBridge";

export default function DocumentTemplateEditorRoute() {
  const { template } = useLoaderData<typeof loader>();

  return (
    <div className="container mx-auto py-6">
      <PageHeader title={`Editing: ${template.name}`} />
      <DocumentDesignerBridge
        templateId={template.key}
        onSave={(updatedTemplate) => {
          // Handle save in main app
          saveTemplate(updatedTemplate);
        }}
        onError={(error) => {
          // Handle errors
          showErrorToast(error.message);
        }}
        height={800}
      />
    </div>
  );
}
```

#### 3. Update Bundle Configuration

```typescript
// vite.stub-client-only.ts
// Remove @pdfme/@tiptap stubs since they're now in separate Worker
const CLIENT_ONLY_PREFIXES = [
  // Keep only what's needed in main app
  // "@pdfme/*" removed - now in separate Worker
] as const;
```

### Phase 3: Implement Shared Authentication

#### 1. Create Auth Service

```typescript
// shared-ui/src/hooks/useAuth.ts
export function useCrossWorkerAuth() {
  const [session, setSession] = useState<CrossWorkerSession | null>(null);

  const validateSession = useCallback(async (token: string) => {
    try {
      const response = await fetch(`${MAIN_WORKER_URL}/api/auth/verify`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      return response.ok;
    } catch (error) {
      console.error("Session validation failed:", error);
      return false;
    }
  }, []);

  const getSessionForWorker = useCallback(
    (workerUrl: string) => {
      // Include worker-specific permissions
      return {
        accessToken: session?.accessToken,
        user: session?.user,
        permissions: getWorkerPermissions(workerUrl),
        expiresAt: session?.expiresAt,
      };
    },
    [session],
  );

  return {
    session,
    validateSession,
    getSessionForWorker,
    logoutFromAllWorkers,
  };
}
```

#### 2. Create Worker Communication Layer

```typescript
// shared-ui/src/utils/workerCommunication.ts
export class WorkerCommunication {
  private workers: Map<string, WorkerConfig> = new Map();

  constructor(config: WorkerConfig[]) {
    config.forEach((worker) => {
      this.workers.set(worker.name, worker);
    });
  }

  async forwardRequest(
    workerName: string,
    request: Request,
    session: CrossWorkerSession,
  ): Promise<Response> {
    const worker = this.workers.get(workerName);
    if (!worker) {
      throw new Error(`Worker ${workerName} not configured`);
    }

    // Clone request with worker-specific headers
    const forwardHeaders = new Headers(request.headers);
    forwardHeaders.set("X-Worker-Request", "true");
    forwardHeaders.set("X-Session-Worker", worker.name);
    forwardHeaders.set("Authorization", `Bearer ${session.accessToken}`);

    const forwardRequest = new Request(
      `${worker.url}${new URL(request.url).pathname}`,
      {
        method: request.method,
        headers: forwardHeaders,
        body: request.body,
        redirect: "manual",
      },
    );

    return fetch(forwardRequest);
  }

  async broadcastEvent(event: WorkerEvent, data: any) {
    const promises = Array.from(this.workers.values()).map((worker) =>
      fetch(`${worker.url}/api/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Worker-Event": event.type,
        },
        body: JSON.stringify({ ...data, event }),
      }),
    );

    return Promise.allSettled(promises);
  }
}
```

### Phase 4: Performance Testing

#### 1. Benchmark Script

```bash
#!/bin/bash
# benchmark-microfrontends.sh

echo "=== Micro Frontend Performance Benchmark ==="
echo "Time: $(date)"
echo ""

# 1. Cold start times
echo "1. Cold Start Times:"
echo "Main Worker:"
time curl -s -o /dev/null -w "%{time_starttransfer}\n" https://portal.example.com/health

echo "Document UI Worker:"
time curl -s -o /dev/null -w "%{time_starttransfer}\n" https://documents-ui.example.com/health

echo "Admin Worker:"
time curl -s -o /dev/null -w "%{time_starttransfer}\n" https://admin-ui.example.com/health

# 2. Bundle sizes
echo ""
echo "2. Bundle Sizes:"
echo "Main Worker:"
npx wrangler deploy --config wrangler.expanded.jsonc --dry-run 2>&1 | grep "gzip"

echo "Document UI Worker:"
npx wrangler deploy --config workers/documents-ui/wrangler.documents-ui.jsonc --dry-run 2>&1 | grep "gzip"

# 3. Memory usage (requires Workers Paid plan)
echo ""
echo "3. Memory Usage (mock):"
echo "Main Worker: ~45MB (estimated)"
echo "Document UI Worker: ~65MB (estimated - includes PDF libraries)"
echo "Admin Worker: ~35MB (estimated)"
echo "Total: ~145MB vs monolith ~150MB"

# 4. Compute time
echo ""
echo "4. Compute Time Test:"
echo "Document generation (parallel):"
time curl -X POST https://documents-ui.example.com/api/preview/template123 \
  -H "Content-Type: application/json" \
  -d '{"data": {"name": "Test"}}' \
  -o /dev/null

# 5. Error rate
echo ""
echo "5. Error Rate Monitoring:"
echo "Check Sentry for error rates by worker"
```

#### 2. Monitoring Dashboard

```typescript
// Create monitoring component
import { useEffect, useState } from 'react';

export function WorkerHealthDashboard() {
  const [health, setHealth] = useState<WorkerHealth[]>([]);

  useEffect(() => {
    const workers = [
      { name: 'main', url: import.meta.env.VITE_MAIN_WORKER_URL },
      { name: 'documents', url: import.meta.env.VITE_DOCUMENTS_WORKER_URL },
      { name: 'admin', url: import.meta.env.VITE_ADMIN_WORKER_URL }
    ];

    const checkHealth = async () => {
      const healthChecks = await Promise.allSettled(
        workers.map(async worker => {
          try {
            const startTime = performance.now();
            const response = await fetch(`${worker.url}/health`);
            const endTime = performance.now();

            return {
              name: worker.name,
              status: response.ok ? 'healthy' : 'unhealthy',
              responseTime: Math.round(endTime - startTime),
              lastChecked: new Date().toISOString()
            };
          } catch (error) {
            return {
              name: worker.name,
              status: 'down',
              responseTime: null,
              lastChecked: new Date().toISOString(),
              error: error.message
            };
          }
        })
      );

      setHealth(healthChecks.map(result =>
        result.status === 'fulfilled' ? result.value : {
          name: 'unknown',
          status: 'error',
          responseTime: null,
          lastChecked: new Date().toISOString(),
          error: 'Failed to check health'
        }
      ));
    };

    checkHealth();
    const interval = setInterval(checkHealth, 30000); // Every 30 seconds

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {health.map(worker => (
        <div key={worker.name} className={`p-4 rounded-lg ${
          worker.status === 'healthy' ? 'bg-green-50 border-green-200' :
          worker.status === 'unhealthy' ? 'bg-yellow-50 border-yellow-200' :
          'bg-red-50 border-red-200'
        } border`}>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium capitalize">{worker.name} Worker</h3>
              <div className="flex items-center gap-2 mt-1">
                <div className={`w-2 h-2 rounded-full ${
                  worker.status === 'healthy' ? 'bg-green-500' :
                  worker.status === 'unhealthy' ? 'bg-yellow-500' :
                  'bg-red-500'
                }`}></div>
                <span className="text-sm text-gray-600">{worker.status}</span>
              </div>
            </div>
            {worker.responseTime && (
              <div className="text-right">
                <div className="text-lg font-semibold">{worker.responseTime}ms</div>
                <div className="text-xs text-gray-500">Response Time</div>
              </div>
            )}
          </div>
          {worker.error && (
            <div className="mt-2 text-sm text-red-600">
              {worker.error}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

### Phase 5: Rollout Strategy

#### 1. Staging Deployment Checklist

```bash
[x] Deploy document UI Worker to staging
[x] Deploy main Worker with service binding
[ ] Test document designer functionality
[ ] Monitor error rates
[ ] Test authentication flow
[ ] Test performance
[ ] Test rollback procedure
[ ] Gather team feedback
```

#### 2. Gradual Production Rollout

```typescript
// Feature flag for gradual rollout
const DOCUMENT_MICROFRONTEND_FEATURE_FLAG = {
  enabled: false,
  percentage: 0, // Start with 0%
  increaseDailyBy: 10, // Increase by 10% daily
  maxPercentage: 100,
  userGroups: ["beta-testers", "internal-team"],
};

export function shouldUseMicrofrontend(userId: string): boolean {
  if (!DOCUMENT_MICROFRONTEND_FEATURE_FLAG.enabled) {
    return false;
  }

  // Check user groups
  if (
    DOCUMENT_MICROFRONTEND_FEATURE_FLAG.userGroups.includes("beta-testers") &&
    isBetaTester(userId)
  ) {
    return true;
  }

  // Percentage-based rollout
  const rolloutPercentage = DOCUMENT_MICROFRONTEND_FEATURE_FLAG.percentage;
  const userHash = hashUserId(userId);
  const userPercentage = userHash % 100;

  return userPercentage < rolloutPercentage;
}
```

#### 3. Rollback Procedure

```bash
# Rollback steps
1. Disable micro frontend feature flag
2. Redirect all traffic to monolith
3. Keep micro frontends running but idle
4. Monitor for any issues
5. If issues persist for 24h, rollback deployment

# Emergency rollback command
./scripts/rollback-microfrontends.sh
```

### Common Issues & Solutions

#### Issue 1: Cross-Worker Latency

**Symptoms**: Slow response times between Workers
**Solution**: Implement request batching and caching

```typescript
// Request batching
class RequestBatcher {
  private batchQueue: Map<string, Request[]> = new Map();
  private batchTimer: Map<string, NodeJS.Timeout> = new Map();

  async batchRequest(
    workerName: string,
    request: Request,
    timeout = 50, // Batch for 50ms
  ): Promise<Response> {
    const batchKey = `${workerName}:${request.method}:${new URL(request.url).pathname}`;

    if (!this.batchQueue.has(batchKey)) {
      this.batchQueue.set(batchKey, []);
    }

    this.batchQueue.get(batchKey)!.push(request);

    // Clear existing timer
    if (this.batchTimer.has(batchKey)) {
      clearTimeout(this.batchTimer.get(batchKey)!);
    }

    // Set new timer
    return new Promise((resolve, reject) => {
      this.batchTimer.set(
        batchKey,
        setTimeout(async () => {
          const requests = this.batchQueue.get(batchKey)!;
          this.batchQueue.delete(batchKey);

          try {
            // Batch process requests
            const responses = await this.processBatch(workerName, requests);
            resolve(responses[0]); // Return first response
          } catch (error) {
            reject(error);
          }
        }, timeout),
      );
    });
  }
}
```

#### Issue 2: Session Synchronization Problems

**Symptoms**: Logged out when switching between Workers
**Solution**: Centralized session store with refresh tokens

```typescript
// Central session store
class CentralizedSessionStore {
  private sessions: Map<string, SessionData> = new Map();

  async getSession(token: string): Promise<SessionData | null> {
    // Check cache first
    if (this.sessions.has(token)) {
      return this.sessions.get(token)!;
    }

    // Validate with main auth
    const response = await fetch(`${MAIN_WORKER_URL}/api/auth/validate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const sessionData = await response.json();
      this.sessions.set(token, sessionData);
      return sessionData;
    }

    return null;
  }

  async refreshSession(oldToken: string): Promise<string | null> {
    const response = await fetch(`${MAIN_WORKER_URL}/api/auth/refresh`, {
      method: "POST",
      headers: { Authorization: `Bearer ${oldToken}` },
    });

    if (response.ok) {
      const { token } = await response.json();
      return token;
    }

    return null;
  }
}
```

### Success Metrics Dashboard

```typescript
// Success metrics tracking
export const MICROFRONTEND_METRICS = {
  bundleSize: {
    main: 0, // Target: < 500KB
    documents: 0, // Target: < 800KB
    admin: 0, // Target: < 400KB
  },
  coldStart: {
    main: 0, // Target: < 300ms
    documents: 0, // Target: < 300ms
    admin: 0, // Target: < 300ms
  },
  errorRate: {
    main: 0, // Target: < 0.1%
    documents: 0, // Target: < 0.1%
    admin: 0, // Target: < 0.1%
  },
  deploymentTime: {
    main: 0, // Target: < 2min
    documents: 0, // Target: < 1min
    admin: 0, // Target: < 1min
  },
};

// Update metrics function
export async function updateMetrics() {
  // Collect metrics from Workers
  const metrics = await Promise.all([
    fetchMetrics(MAIN_WORKER_URL),
    fetchMetrics(DOCUMENTS_WORKER_URL),
    fetchMetrics(ADMIN_WORKER_URL),
  ]);

  // Update dashboard
  updateDashboard(metrics);

  // Send to monitoring service
  sendToMonitoring(metrics);
}
```

### Next Steps After Implementation

1. **Week 1-2**: Monitor stability and performance
2. **Week 3-4**: Optimize cross-Worker communication
3. **Week 5-6**: Extract next micro frontend (Admin UI)
4. **Week 7-8**: Implement advanced caching
5. **Week 9-10**: Add offline capabilities
6. **Week 11-12**: Complete migration to full micro frontend architecture

### Support & Troubleshooting

**Common Issues:**

- CORS errors between Workers
- Session not persisting
- Slow iframe loading
- Bundle size not decreasing

**Support Channels:**

- Team chat for immediate issues
- Documentation for reference
- Monitoring dashboard for metrics
- Automated tests for validation

**Escalation Path:**

1. Check monitoring dashboard
2. Review logs in Sentry
3. Check Worker health endpoints
4. Rollback if critical issue
5. Contact team lead if unresolved
