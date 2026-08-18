# Deployment Guide: Worker-Based Micro Frontends

**Status: ACTIVE**  
**Pattern: Domain Worker Isolation with Module Federation**

## Deployment Strategy for Worker-Based Architecture

### Sequential Deployment Order (Worker-First)

```bash
# 1. Deploy Domain Workers (RPC APIs)
npm run deploy:excel:uat       # Excel worker first (independent)
npm run deploy:documents:uat    # Documents worker (heavy PDFME)
npm run deploy:pdf:uat         # PDF generation worker

# 2. Deploy Portal with Updated Federation Config
npm run deploy:uat             # Portal with federated imports

# 3. Verify Cross-Worker Communication
./scripts/verify-worker-communication.sh --env staging
```

### Environment-Specific Configurations

#### Development Environment (Local)

```yaml
development:
  workers:
    documents:
      url: "http://localhost:8787"
      federation_url: "http://localhost:5174" # Vite dev server
      ports:
        worker: 8787
        dev_server: 5174
        inspector: 9230

    excel:
      url: "http://localhost:8788"
      ports:
        worker: 8788
        inspector: 9231

    pdf:
      url: "http://localhost:8789" # Optional separate port

  portal:
    url: "http://localhost:5173"
    federation_remotes:
      documents: "documents@http://localhost:5174/remoteEntry.js"

  scripts:
    start_all: "npm run dev:all-workers"
    start_individual: "bash scripts/start-both-workers.sh"
```

#### Staging Environment (Cloudflare)

```yaml
staging:
  workers:
    documents:
      url: "https://documents-worker-staging.irecon.com"
      federation_url: "https://documents-staging.irecon.com" # Static assets
      d1_database: "documents-staging"

    excel:
      url: "https://excel-worker-staging.irecon.com"
      d1_database: "excel-staging"

    pdf:
      url: "https://pdf-worker-staging.irecon.com"
      assets_binding: "fonts-staging"

  portal:
    url: "https://portal-staging.irecon.com"
    federation_remotes:
      documents: "documents@https://documents-staging.irecon.com/remoteEntry.js"

  monitoring:
    cloudflare_analytics: true
    sentry_traces: true
    error_rate_target: "< 0.5%"
```

#### Production Environment (Cloudflare)

```yaml
production:
  workers:
    documents:
      url: "https://documents-worker.irecon.com"
      federation_url: "https://documents.irecon.com" # CDN
      d1_database: "documents-production"
      scale:
        min_instances: 3
        max_instances: 50

    excel:
      url: "https://excel-worker.irecon.com"
      d1_database: "excel-production"
      scale:
        min_instances: 2
        max_instances: 20

    pdf:
      url: "https://pdf-worker.irecon.com"
      assets_binding: "fonts-production"
      memory_limit: "256MB"

  portal:
    url: "https://portal.irecon.com"
    federation_remotes:
      documents: "documents@https://documents.irecon.com/remoteEntry.js"

  monitoring:
    cloudflare_analytics: true
    sentry_traces: true
    grafana_dashboards: true
    alerting:
      error_rate_threshold: "> 1%"
      response_time_threshold: "> 2s"
      memory_threshold: "> 80%"
```

## Worker Deployment Commands

### Deploy Individual Worker

```bash
# Deploy Documents worker to staging
cd workers/documents
npm run deploy

# Deploy Excel worker with specific environment
wrangler deploy --config ../wrangler.excel.jsonc --env staging

# Deploy PDF generation worker
wrangler deploy --config ../wrangler.pdf.jsonc --env production

# View deployment details
wrangler deploy --config wrangler.documents.jsonc --dry-run --outdir ./dist
```

### Combined Worker Deployment Script

```bash
#!/bin/bash
# scripts/deploy-all-workers.sh

echo "🚀 Deploying all Workers..."
echo ""

# Deploy Documents Worker
echo "📄 Deploying Documents Worker..."
cd workers/documents
npm run deploy
DOCUMENTS_DEPLOY=$?

# Deploy Excel Worker
echo "📊 Deploying Excel Worker..."
cd ../excel
npm run deploy
EXCEL_DEPLOY=$?

# Deploy PDF Worker
echo "🔄 Deploying PDF Generation Worker..."
cd ../pdf
npm run deploy
PDF_DEPLOY=$?

# Check results
if [ $DOCUMENTS_DEPLOY -eq 0 ] && [ $EXCEL_DEPLOY -eq 0 ] && [ $PDF_DEPLOY -eq 0 ]; then
  echo "✅ All Workers deployed successfully!"
else
  echo "❌ Worker deployment failed. Check logs above."
  exit 1
fi
```

### Canary Deployment for Workers

```bash
# Gradual rollout for Documents worker
./scripts/deploy-worker-canary.sh \
  --worker documents \
  --percentage 10 \
  --monitor-urls \
    "https://documents-worker.irecon.com/health" \
    "https://portal.irecon.com/_federation/documents" \
  --metrics \
    "error_rate" \
    "response_time" \
    "memory_usage" \
  --rollback-triggers \
    "error_rate > 5%" \
    "response_time > 2000ms" \
    "memory_usage > 85%"
```

## Health Checks & Monitoring

### Worker Health Endpoints

```bash
# Documents Worker Health
curl -s https://documents-worker.irecon.com/health
# Expected: {"status":"healthy","domain":"documents","timestamp":"..."}

# Excel Worker Health
curl -s https://excel-worker.irecon.com/health
# Expected: {"status":"healthy","domain":"excel","timestamp":"..."}

# PDF Worker (no health endpoint, but has / URL)
curl -s https://pdf-worker.irecon.com/
```

### Federation Health Checks

```bash
# Check Module Federation loading
curl -s https://documents.irecon.com/remoteEntry.js | head -c 100
# Should return JavaScript content

# Portal federation health
curl -s https://portal.irecon.com/_federation/health
# Returns status of all federated domains
```

### Performance Metrics Collection

```typescript
// Cloudflare Analytics Metrics
const workerMetrics = {
  documents_worker: {
    requests_per_second: 150,
    average_response_time: 45, // ms
    error_rate: 0.003, // 0.3%
    memory_average: 65, // MB
    cpu_time: 12.5, // milliseconds
  },

  excel_worker: {
    requests_per_second: 85,
    average_response_time: 120, // ms (Excel generation is heavier)
    error_rate: 0.001, // 0.1%
    memory_average: 42, // MB
  },

  portal: {
    bundle_size: 420, // KB gzipped
    federation_load_time: 180, // ms
    cross_worker_calls: 230, // calls per minute
  },
};
```

## Rollback Procedures for Workers

### Worker-Specific Rollback Triggers

```yaml
documents_worker_triggers:
  # Performance triggers
  load_time_over_1000ms: true
  error_rate_over_5_percent: true
  memory_usage_over_80_percent: true

  # Operational triggers
  federation_fails_to_load: true
  template_generation_fails: true
  font_assets_unavailable: true

  # User experience triggers
  editor_unusable_reports: 3
  customer_support_tickets: 5

excel_worker_triggers:
  # Performance triggers
  generation_time_over_5000ms: true
  memory_usage_over_256mb: true
  rate_limit_exceeded: true

  # Data triggers
  excel_generation_fails: true
  formula_calculation_errors: true

pdf_worker_triggers:
  # Performance triggers
  generation_time_over_3000ms: true
  memory_usage_over_128mb: true

  # Quality triggers
  pdf_rendering_errors: true
  font_substitution_issues: true
```

### Worker Rollback Commands

```bash
# Rollback Documents Worker
./scripts/rollback-worker.sh \
  --worker documents \
  --reason "performance_degradation" \
  --target-version v1.1.0 \
  --notify-slack "#alerts" \
  --preserve-logs \
  --verify-health-after

# Emergency Rollback Specific Worker
wrangler rollback --config wrangler.documents.jsonc \
  --message "Critical performance issue" \
  --keep-logs 100

# Rollback with DNS change (immediate)
./scripts/rollback-dns.sh \
  --worker documents \
  --point-to "documents-worker-v1.irecon.com" \
  --ttl 60
```

## Worker Configuration Management

### Environment Variables Management

```bash
# Set secrets for Workers
wrangler secret put WORKER_SHARED_SECRET --config wrangler.documents.jsonc
wrangler secret put DATABASE_URL --config wrangler.excel.jsonc

# Set environment variables
wrangler secret put ASSETS_BINDING --config wrangler.pdf.jsonc --json '{"font_dir": "/fonts"}'

# View current configuration
wrangler config get --config wrangler.documents.jsonc
```

### Worker Version Management

```typescript
// Workers communicate version compatibility
interface WorkerVersionCompatibility {
  documents: {
    min_portal_version: "1.0.0";
    max_portal_version: "2.0.0";
    compatible_with: ["excel@>=1.0.0", "pdf@>=1.0.0"];
  };

  excel: {
    min_portal_version: "1.0.0";
    requires_documents_version: ">=1.2.0"; // Needs template features
  };

  portal: {
    requires_workers: {
      documents: ">=1.0.0";
      excel: ">=1.0.0";
      pdf: ">=1.0.0";
    };
  };
}
```

## CI/CD Pipeline for Workers

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy-workers.yml
name: Deploy Workers

on:
  push:
    branches: [main]
    paths:
      - "workers/**"
      - "wrangler.**.jsonc"

jobs:
  deploy-workers:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Install dependencies
        run: npm ci

      - name: Build Workers
        run: |
          cd workers/documents && npm run build
          cd ../excel && npm run build

      - name: Run Tests
        run: |
          npm run test:unit
          npm run test:integration:workers

      - name: Deploy to Staging
        if: github.ref == 'refs/heads/main'
        run: |
          ./scripts/deploy-workers.sh --env staging

      - name: Run Integration Tests
        if: github.ref == 'refs/heads/main'
        run: |
          ./scripts/test-worker-integration.sh --env staging

      - name: Deploy to Production (Canary)
        if: github.ref == 'refs/heads/main'
        run: |
          ./scripts/deploy-worker-canary.sh --percentage 10
```

## Monitoring & Observability Setup

### Cloudflare Dashboard Configuration

```bash
# Enable Analytics for Workers
wrangler analytics enable --config wrangler.documents.jsonc
wrangler analytics enable --config wrangler.excel.jsonc

# Configure Log Retention
wrangler config set --config wrangler.documents.jsonc \
  observability.logs.retention_days 30

# Set up Alert Policies
wrangler alerts create \
  --config wrangler.documents.jsonc \
  --name "High Error Rate" \
  --condition "error_rate > 5%" \
  --channel slack

wrangler alerts create \
  --config wrangler.excel.jsonc \
  --name "Slow Generation" \
  --condition "p95_response_time > 5000ms" \
  --channel pagerduty
```

### Sentry Integration for Workers

```typescript
// workers/documents/index.ts
import { Hono } from "hono";
import * as Sentry from "@sentry/cloudflare";

const app = new Hono<{ Bindings: DocumentsWorkerEnv }>();

// Sentry Error Tracking
app.onError((err, c) => {
  Sentry.captureException(err, {
    tags: {
      worker: "documents",
      path: c.req.path,
      method: c.req.method,
    },
  });

  console.error("Worker error:", err);
  return c.json({ error: "Internal server error" }, 500);
});

// Performance Monitoring
app.use("*", async (c, next) => {
  const transaction = Sentry.startTransaction({
    op: "http.server",
    name: `${c.req.method} ${c.req.path}`,
  });

  try {
    await next();
  } finally {
    transaction.finish();
  }
});
```

## Troubleshooting Worker Issues

### Common Worker Issues

#### Issue: Module Federation Not Loading from Worker

```bash
# Symptoms: Console errors about remoteEntry.js, white screen
# Diagnosis:
./scripts/diagnose-federation.sh --worker documents

# Solutions:
# 1. Check Worker is running
curl -s https://documents-worker.irecon.com/health

# 2. Check remoteEntry.js is accessible
curl -s https://documents.irecon.com/remoteEntry.js | head -5

# 3. Check CORS configuration
# In workers/documents/index.ts, verify ALLOWED_ORIGINS includes portal URL

# 4. Check portal federation config
# In portal vite.config.ts, verify remote URL is correct

# 5. Use iframe fallback temporarily
<IframeFallback domain="documents" path="/designer" />
```

#### Issue: Cross-Worker API Calls Failing

```bash
# Symptoms: Template saving fails, preview generation broken
# Diagnosis:
./scripts/diagnose-cross-worker.sh --from portal --to documents

# Solutions:
# 1. Check WORKER_SHARED_SECRET matches
echo $WORKER_SHARED_SECRET # In portal .env
wrangler secret get WORKER_SHARED_SECRET --config wrangler.documents.jsonc

# 2. Check CORS for API endpoints
curl -v -X OPTIONS https://documents-worker.irecon.com/api/templates/save

# 3. Check network connectivity
./scripts/test-worker-connectivity.sh --portal-to documents

# 4. Implement retry logic with exponential backoff
```

#### Issue: Worker Memory Limit Exceeded

```bash
# Symptoms: Worker crashes, "memory limit exceeded" errors
# Diagnosis:
./scripts/diagnose-memory.sh --worker documents

# Solutions:
# 1. Increase memory limit (temporary)
wrangler config set --config wrangler.documents.jsonc \
  limits.memory_mb 256

# 2. Optimize memory usage
# - Use streaming for large responses
# - Clear caches periodically
# - Use smaller chunks for large operations

# 3. Implement memory monitoring
class MemoryMonitor {
  checkMemory() {
    if (performance.memory.usedJSHeapSize > WARNING_THRESHOLD) {
      this.triggerCleanup();
    }
  }
}
```

## Worker Scaling & Performance

### Horizontal Scaling Configuration

```yaml
# wrangler.documents.jsonc scaling section
scaling:
  min_instances: 3
  max_instances: 50
  scaling_rules:
    - metric: "requests_per_second"
      threshold: 100
      direction: "up"
      amount: 5
    - metric: "cpu_usage_percent"
      threshold: 70
      direction: "up"
      amount: 3
    - metric: "requests_per_second"
      threshold: 30
      direction: "down"
      amount: 2
```

### Caching Strategies for Workers

```typescript
// Implement caching for expensive operations
class TemplateCache {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly TTL = 5 * 60 * 1000; // 5 minutes

  async getOrGenerate(templateId: string, generator: () => Promise<any>) {
    const cached = this.cache.get(templateId);

    if (cached && Date.now() - cached.timestamp < this.TTL) {
      return cached.data;
    }

    const data = await generator();
    this.cache.set(templateId, { data, timestamp: Date.now() });

    // Clean old entries periodically
    if (this.cache.size > 1000) {
      this.cleanup();
    }

    return data;
  }
}
```

## Security Best Practices for Workers

### Worker Security Configuration

```bash
# Enable security features
wrangler config set --config wrangler.documents.jsonc \
  security.csp_enabled true

# Configure CORS strictly
wrangler config set --config wrangler.documents.jsonc \
  cors.allowed_origins "https://portal.irecon.com,https://staging.irecon.com"

# Enable API authentication
wrangler secret put API_AUTH_SECRET --config wrangler.documents.jsonc

# Rate limiting configuration
wrangler config set --config wrangler.documents.jsonc \
  rate_limiting.enabled true \
  rate_limiting.requests_per_minute 1000
```

## Cost Monitoring for Workers

### Worker Cost Tracking

```bash
# Monitor Worker costs
wrangler billing estimate --config wrangler.documents.jsonc

# Set cost alerts
wrangler alerts create \
  --config wrangler.documents.jsonc \
  --name "Cost Alert" \
  --condition "estimated_monthly_cost > 100" \
  --channel email

# Optimize costs
# 1. Use appropriate instance sizes
# 2. Implement caching to reduce compute
# 3. Use D1 for structured data vs KV for cache
# 4. Monitor and clean up unused resources
```

This deployment guide provides comprehensive procedures for deploying, monitoring, and operating worker-based micro frontends in the Irecon Insurance application.
