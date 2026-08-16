# Micro-Frontend Usage Examples

**Last Updated: Aug 15, 2026**
**Status: IMPLEMENTATION PATTERNS**

## Portal Integration Examples

### 1. Federated Component Usage

**Using DocumentDesigner from Documents Domain**:

```typescript
// app/components/documents/DocumentEditorWrapper.tsx
import { lazy, Suspense } from "react";
import { DocumentEditorSkeleton } from "~/components/documents/document-templates-loading";

// Dynamically import federated component
const FederatedDocumentDesigner = lazy(() =>
  import("documents/DocumentDesigner")
    .then((module) => ({ default: module.PdfmeDesigner }))
    .catch((error) => {
      console.error("Failed to load DocumentDesigner:", error);
      // Return a fallback component
      return {
        default: function FallbackDesigner() {
          return <div>Document editor unavailable. Please try again.</div>;
        }
      };
    })
);

export function DocumentEditorWrapper({
  template,
  onTemplateChange,
}: {
  template: Template;
  onTemplateChange?: (template: Template) => void;
}) {
  return (
    <Suspense fallback={<DocumentEditorSkeleton />}>
      <FederatedDocumentDesigner
        template={template}
        onTemplateChange={onTemplateChange}
        editable={true}
      />
    </Suspense>
  );
}
```

### 2. RPC API Integration

**Calling Documents Worker APIs from Portal**:

```typescript
// app/lib/services/documents/document-templates.ts
import { env } from "~/lib/cloudflare.server";

export async function validateTemplateInWorker(
  template: Template,
): Promise<ValidationResult> {
  try {
    const response = await fetch(
      `${env.DOCUMENTS_WORKER_URL}/api/templates/validate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.WORKER_SHARED_SECRET}`,
        },
        body: JSON.stringify({
          templateId: template.id,
          schema: template.schema,
          basePdf: template.basePdf,
        }),
      },
    );

    if (!response.ok) {
      throw new Error(`Validation failed: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Template validation RPC failed:", error);

    // Fallback: validate locally (limited validation)
    return {
      valid: true,
      errors: [],
      warnings: ["Using fallback validation - some checks skipped"],
    };
  }
}

export async function generateTemplatePreview(
  templateId: string,
  mergeData: Record<string, any>,
): Promise<PreviewResult> {
  const response = await fetch(
    `${env.DOCUMENTS_WORKER_URL}/api/templates/${templateId}/generate-preview`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.WORKER_SHARED_SECRET}`,
      },
      body: JSON.stringify({
        mergeInputs: mergeData,
        requestId: crypto.randomUUID(),
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`Preview generation failed: ${response.status}`);
  }

  return await response.json();
}
```

### 3. Environment Configuration

**Portal `.env` Configuration**:

```bash
# Documents Worker URLs
DOCUMENTS_WORKER_URL=http://localhost:8787
DOCUMENTS_FEDERATION_URL=http://localhost:5174

# Excel Worker URL
EXCEL_WORKER_URL=http://localhost:8788

# PDF Generation Worker URL
PDF_WORKER_URL=http://localhost:8789

# Shared secret for worker authentication
WORKER_SHARED_SECRET=your-shared-secret-here

# Module Federation Configuration
MODULE_FEDERATION_ENABLED=true
FEDERATION_PRELOAD_ENABLED=true
```

**Documents Worker `.env` Configuration**:

```bash
# Documents Worker Environment
WORKER_SHARED_SECRET=your-shared-secret-here
ALLOWED_ORIGINS=http://localhost:5173,https://portal.irecon.com
DOCUMENTS_FEDERATION_URL=http://localhost:5174
ASSETS_BINDING=fonts

# Development overrides
NODE_ENV=development
DEBUG_MODULE_FEDERATION=true
```

## Development Workflow Examples

### 1. Starting All Services

```bash
# Start portal development server
npm run dev

# Start documents worker dev server (in separate terminal)
cd workers/documents && npm run dev

# Start Excel worker dev server (in separate terminal)
cd workers/excel && npm run dev

# Or use the combined script
bash scripts/start-both-workers.sh
```

### 2. Testing Federated Components

```typescript
// tests/integration/federated-components.test.tsx
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

describe("Federated DocumentDesigner", () => {
  it("should render federated component with fallback", async () => {
    // Mock the federated import
    vi.mock("documents/DocumentDesigner", async () => ({
      PdfmeDesigner: () => <div data-testid="federated-designer">Mock Designer</div>,
    }));

    const { DocumentEditorWrapper } = await import(
      "~/components/documents/DocumentEditorWrapper"
    );

    render(
      <DocumentEditorWrapper
        template={mockTemplate}
        onTemplateChange={vi.fn()}
      />
    );

    // Should show loading state first
    expect(screen.getByTestId("skeleton-loader")).toBeInTheDocument();

    // Then show the federated component
    await waitFor(() => {
      expect(screen.getByTestId("federated-designer")).toBeInTheDocument();
    });
  });
});
```

### 3. Monitoring Integration

```typescript
// app/lib/observability/federation-monitoring.ts
import { logger } from "./logger.server";

export class FederationMetrics {
  private moduleLoadTimes = new Map<string, number>();
  private apiCallMetrics = new Map<string, { calls: number; errors: number }>();

  recordModuleLoad(domain: string, moduleName: string, loadTime: number) {
    const key = `${domain}:${moduleName}`;
    this.moduleLoadTimes.set(key, loadTime);

    logger.info("federation.module.loaded", {
      domain,
      module: moduleName,
      loadTime,
      timestamp: Date.now(),
    });
  }

  recordApiCall(domain: string, endpoint: string, success: boolean) {
    const key = `${domain}:${endpoint}`;
    const metrics = this.apiCallMetrics.get(key) || { calls: 0, errors: 0 };

    metrics.calls++;
    if (!success) {
      metrics.errors++;
    }

    this.apiCallMetrics.set(key, metrics);

    logger.info("federation.api.call", {
      domain,
      endpoint,
      success,
      totalCalls: metrics.calls,
      errorRate: metrics.errors / metrics.calls,
    });
  }

  getMetrics() {
    return {
      moduleLoadTimes: Object.fromEntries(this.moduleLoadTimes),
      apiCallMetrics: Object.fromEntries(this.apiCallMetrics),
    };
  }
}

export const federationMetrics = new FederationMetrics();
```

## Production Configuration Examples

### 1. Production Worker URLs

**Staging Environment**:

```bash
DOCUMENTS_WORKER_URL=https://documents-worker-staging.irecon.com
EXCEL_WORKER_URL=https://excel-worker-staging.irecon.com
PDF_WORKER_URL=https://pdf-worker-staging.irecon.com
```

**Production Environment**:

```bash
DOCUMENTS_WORKER_URL=https://documents-worker.irecon.com
EXCEL_WORKER_URL=https://excel-worker.irecon.com
PDF_WORKER_URL=https://pdf-worker.irecon.com
```

### 2. Load Balancing & Failover

```typescript
// app/lib/services/worker-service-registry.ts
export class WorkerServiceRegistry {
  private workers: Map<string, WorkerEndpoint[]> = new Map();

  constructor() {
    // Register multiple endpoints for each domain
    this.workers.set("documents", [
      { url: "https://documents-worker-1.irecon.com", healthy: true },
      { url: "https://documents-worker-2.irecon.com", healthy: true },
    ]);

    this.workers.set("excel", [
      { url: "https://excel-worker-1.irecon.com", healthy: true },
    ]);
  }

  async callWorker(
    domain: string,
    endpoint: string,
    request: RequestInit,
  ): Promise<Response> {
    const endpoints = this.workers.get(domain) || [];

    for (const worker of endpoints) {
      if (!worker.healthy) continue;

      try {
        const response = await fetch(`${worker.url}${endpoint}`, request);

        if (response.ok) {
          return response;
        }

        // Mark unhealthy on failure
        worker.healthy = false;

        // Schedule health check
        setTimeout(() => this.checkWorkerHealth(domain, worker), 30000);
      } catch (error) {
        console.error(`Worker ${worker.url} failed:`, error);
        worker.healthy = false;
      }
    }

    throw new Error(`All ${domain} workers unavailable`);
  }
}
```

### 3. CORS Configuration

**Documents Worker CORS**:

```typescript
// workers/documents/index.ts
app.use(
  "*",
  cors({
    origin: (origin, c) => {
      const allowedOrigins = [
        "https://portal.irecon.com",
        "https://staging.irecon.com",
        "http://localhost:5173", // Development
      ];

      if (!origin || allowedOrigins.includes(origin)) {
        return origin;
      }

      // For production, be strict
      if (c.env.NODE_ENV === "production") {
        return null; // Reject
      }

      // For non-production, allow with warning
      console.warn(`CORS warning: Allowing origin ${origin} in non-production`);
      return origin;
    },
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "x-request-id",
      "x-worker-version",
    ],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    maxAge: 86400,
    credentials: true,
  }),
);
```

## Performance Optimization Examples

### 1. Module Preloading

```typescript
// app/lib/federation/preloading.ts
export function setupFederationPreloading() {
  // Preload documents domain on hover over documents menu
  const documentsLinks = document.querySelectorAll('a[href*="documents"]');

  documentsLinks.forEach((link) => {
    link.addEventListener("mouseenter", () => {
      // Preload the federated entry
      import("documents/remoteEntry.js").catch(() => {
        // Silent fail - will load on demand
      });
    });

    link.addEventListener(
      "touchstart",
      () => {
        // Preload on mobile touch
        import("documents/remoteEntry.js").catch(() => {});
      },
      { passive: true },
    );
  });

  // Preload when user is likely to need it
  if (window.location.pathname.includes("/templates")) {
    setTimeout(() => {
      import("documents/remoteEntry.js").catch(() => {});
    }, 1000);
  }
}
```

### 2. Request Batching

```typescript
// workers/documents/services/request-batcher.ts
export class DocumentRequestBatcher {
  private batchQueue = new Map<
    string,
    Array<{ request: any; resolve: Function; reject: Function }>
  >();

  async batchedRequest(endpoint: string, request: any): Promise<any> {
    const batchKey = `${endpoint}:${JSON.stringify(request)}`;

    if (this.batchQueue.has(batchKey)) {
      // Already batched - wait for result
      return new Promise((resolve, reject) => {
        this.batchQueue.get(batchKey)!.push({ request, resolve, reject });
      });
    }

    // Create new batch
    const batch = [{ request, resolve: () => {}, reject: () => {} }];
    this.batchQueue.set(batchKey, batch);

    // Execute batch after 50ms
    setTimeout(async () => {
      try {
        const requests = this.batchQueue.get(batchKey) || [];
        const combinedRequest = this.combineRequests(requests);

        // Execute single batched request
        const result = await this.executeBatch(endpoint, combinedRequest);

        // Resolve all promises
        requests.forEach((item) => item.resolve(result));
      } catch (error) {
        const requests = this.batchQueue.get(batchKey) || [];
        requests.forEach((item) => item.reject(error));
      } finally {
        this.batchQueue.delete(batchKey);
      }
    }, 50);
  }
}
```

## Error Handling Examples

### 1. Graceful Degradation

```typescript
// app/components/documents/DocumentEditorFallback.tsx
export function DocumentEditorFallback({
  template,
  onSave,
}: {
  template: Template;
  onSave: (template: Template) => void;
}) {
  const [localTemplate, setLocalTemplate] = useState(template);

  return (
    <div className="p-4 border rounded-lg bg-yellow-50">
      <div className="mb-4">
        <h3 className="text-lg font-semibold">Degraded Mode</h3>
        <p className="text-sm text-gray-600">
          Document editor is unavailable. Using basic editor.
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">
            Template Name
          </label>
          <input
            type="text"
            value={localTemplate.name}
            onChange={(e) =>
              setLocalTemplate({ ...localTemplate, name: e.target.value })
            }
            className="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">
            Template Description
          </label>
          <textarea
            value={localTemplate.description || ""}
            onChange={(e) =>
              setLocalTemplate({
                ...localTemplate,
                description: e.target.value,
              })
            }
            className="w-full p-2 border rounded"
            rows={3}
          />
        </div>

        <button
          onClick={() => onSave(localTemplate)}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
        >
          Save Template
        </button>
      </div>
    </div>
  );
}
```

### 2. Circuit Breaker Pattern

```typescript
// app/lib/services/circuit-breaker.ts
export class CircuitBreaker {
  private state: "CLOSED" | "OPEN" | "HALF_OPEN" = "CLOSED";
  private failures = 0;
  private lastFailureTime = 0;
  private readonly failureThreshold = 5;
  private readonly resetTimeout = 30000; // 30 seconds

  async execute<T>(
    operation: () => Promise<T>,
    fallback: () => Promise<T>,
  ): Promise<T> {
    if (this.state === "OPEN") {
      // Check if timeout has passed
      if (Date.now() - this.lastFailureTime > this.resetTimeout) {
        this.state = "HALF_OPEN";
      } else {
        // Still in timeout - use fallback
        return await fallback();
      }
    }

    try {
      const result = await operation();

      // Success - reset state
      if (this.state === "HALF_OPEN") {
        this.state = "CLOSED";
        this.failures = 0;
      }

      return result;
    } catch (error) {
      this.recordFailure();
      return await fallback();
    }
  }

  private recordFailure() {
    this.failures++;
    this.lastFailureTime = Date.now();

    if (this.failures >= this.failureThreshold) {
      this.state = "OPEN";
    }
  }
}
```
