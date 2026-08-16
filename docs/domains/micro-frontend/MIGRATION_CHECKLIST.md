# PDF Template Editor Migration Checklist

**Target**: Separate PDF template editor into Documents Worker  
**Status**: READY FOR IMPLEMENTATION  
**Pattern**: Domain Worker Isolation with Module Federation

## 📋 Pre-Migration Checklist

### ✅ **Infrastructure Ready**

- [x] Documents worker directory structure created (`workers/documents/`)
- [x] Configuration files generated (`wrangler.documents.jsonc`, `vite.config.ts`)
- [x] Hono API server implemented (`index.ts`)
- [x] Module Federation exports configured (`src/exports/`)
- [x] Standard templates created for future domains (`workers/_template/`)
- [x] Documentation updated with patterns and procedures

### ✅ **Analysis Complete**

- [x] PDFME component locations identified (`app/components/documents/`)
- [x] Heavy dependencies analyzed (`@pdfme/ui` 24MB, `@tiptap/*` 3MB)
- [x] Worker architecture understood (Excel & PDF workers already exist)
- [x] Integration points identified (routes, hooks, services)

## 🚀 Migration Phase 1: Move Components to Documents Worker

### Step 1: Move PDFME Components

```bash
# Create component directories in documents worker
mkdir -p workers/documents/src/components
mkdir -p workers/documents/src/hooks
mkdir -p workers/documents/src/utils

# Move PDFME designer component and related files
mv app/components/documents/pdfme-designer.tsx workers/documents/src/components/
mv app/components/documents/pdfme-designer-*.tsx workers/documents/src/components/
mv app/components/documents/pdfme-designer-helpers.ts workers/documents/src/utils/

# Move related hooks
mv app/hooks/use-pdfme-designer-*.ts workers/documents/src/hooks/
mv app/hooks/use-document-template-editor-*.ts workers/documents/src/hooks/
```

### Step 2: Update Component Imports

```bash
# Update paths in moved components
cd workers/documents
find . -type f -name "*.ts" -o -name "*.tsx" | xargs sed -i '' \
  -e 's|~/components/documents/|~/components/|g' \
  -e 's|~/hooks/|~/hooks/|g' \
  -e 's|~/lib/pdf/|../../app/lib/pdf/|g'  # Keep references to shared libs
```

### Step 3: Configure Exports

```typescript
// Update workers/documents/src/exports/DocumentDesigner.tsx
import {
  PdfmeDesigner,
  type PdfmeDesignerHandle,
  type PdfmeDesignerProps,
} from "~/components/pdfme-designer";

// Export for Module Federation
export { PdfmeDesigner, type PdfmeDesignerHandle, type PdfmeDesignerProps };
export default PdfmeDesigner;
```

## 🔗 Migration Phase 2: Portal Integration Updates

### Step 1: Update Portal Vite Configuration

```typescript
// Update portal vite.config.ts (or create vite.config.federation.ts)
import federation from "@module-federation/vite";

export default defineConfig({
  plugins: [
    federation({
      name: "portal",
      remotes: {
        documents: "documents@http://localhost:5174/remoteEntry.js",
      },
      shared: {
        react: { singleton: true },
        "react-dom": { singleton: true },
      },
    }),
  ],
});
```

### Step 2: Update Portal Environment Variables

```bash
# Add to portal .env file
DOCUMENTS_WORKER_URL=http://localhost:8787
DOCUMENTS_FEDERATION_URL=http://localhost:5174
WORKER_SHARED_SECRET=your-shared-secret-here
```

### Step 3: Update Document Editor Usage

```typescript
// BEFORE (in portal):
import { PdfmeDesigner } from "~/components/documents/pdfme-designer";

// AFTER (in portal):
import { lazy, Suspense } from "react";
import { DocumentEditorSkeleton } from "~/components/documents/document-templates-loading";

const FederatedDocumentDesigner = lazy(() =>
  import("documents/DocumentDesigner").then((module) => ({
    default: module.PdfmeDesigner,
  }))
);

function DocumentEditorWrapper({ template, onTemplateChange }) {
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

### Step 4: Update RPC API Calls

```typescript
// BEFORE (direct service calls):
import { saveTemplate } from "~/lib/services/documents/document-templates";

// AFTER (call documents worker):
async function saveTemplateToWorker(template: Template) {
  const response = await fetch(
    `${env.DOCUMENTS_WORKER_URL}/api/templates/save`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${env.WORKER_SHARED_SECRET}`,
      },
      body: JSON.stringify(template),
    },
  );

  if (!response.ok) {
    throw new Error(`Failed to save template: ${response.status}`);
  }

  return await response.json();
}
```

## 🧪 Migration Phase 3: Testing & Validation

### Step 1: Start All Services

```bash
# Terminal 1: Start Documents Worker dev server
cd workers/documents && npm run dev  # Port 5174 (federation) + 8787 (worker)

# Terminal 2: Start Excel Worker (if needed)
cd workers/excel && npm run dev  # Port 8788

# Terminal 3: Start Portal
npm run dev  # Port 5173

# Or use combined script:
bash scripts/start-both-workers.sh
```

### Step 2: Health Check Verification

```bash
# Check Documents Worker health
curl http://localhost:8787/health
# Expected: {"status":"healthy","domain":"documents",...}

# Check Federation remoteEntry.js
curl http://localhost:5174/remoteEntry.js | head -5
# Should return JavaScript content

# Check portal loads federated component
# Navigate to http://localhost:5173/documents/templates/{id}/edit
```

### Step 3: Functional Testing

- [ ] PDFME designer loads in editor
- [ ] Template editing works (add fields, change layout)
- [ ] Save/load operations work via worker API
- [ ] Preview generation works
- [ ] Cross-worker communication functional

### Step 4: Performance Testing

```bash
# Measure bundle sizes
npm run check:bundle
# Portal should be < 500KB gzipped (from ~1.8MB)

# Measure load times
# Use browser devtools to check:
# - DocumentDesigner module load time
# - Cross-worker API call latency
# - Editor initialization time

# Monitor memory usage
# Check memory usage doesn't spike unexpectedly
```

## 🚀 Migration Phase 4: Deployment

### Step 1: Staging Deployment

```bash
# Deploy Documents Worker to staging
cd workers/documents
npm run deploy  # Uses wrangler.documents.jsonc

# Update portal staging deployment
# Add environment variables to staging .env:
DOCUMENTS_WORKER_URL=https://documents-worker-staging.irecon.com
DOCUMENTS_FEDERATION_URL=https://documents-staging.irecon.com

# Deploy portal to staging
npm run deploy:staging
```

### Step 2: Staging Verification

- [ ] Verify staging URLs work
- [ ] Run full integration test suite
- [ ] Check performance metrics
- [ ] Validate user workflows
- [ ] Confirm error rates acceptable (< 0.5%)

### Step 3: Production Canary Deployment

```bash
# Deploy Documents Worker to production (10% traffic)
./scripts/deploy-worker-canary.sh \
  --worker documents \
  --percentage 10 \
  --monitor-metrics

# Monitor for 24 hours
# Check:
# - Error rates
# - Performance metrics
# - User reports
# - Support tickets

# Increase rollout gradually
./scripts/deploy-worker-canary.sh \
  --worker documents \
  --percentage 50 \
  --monitor-metrics

# Full rollout (if all metrics good)
./scripts/deploy-worker-canary.sh \
  --worker documents \
  --percentage 100
```

## 🛠️ Rollback Procedures

### If Issues Occur During Migration

```bash
# 1. Disable federation temporarily (fallback to iframe)
# Update portal to use iframe fallback for document editor

# 2. Rollback Documents Worker
./scripts/rollback-worker.sh --worker documents --target-version previous

# 3. Revert portal changes
git checkout -- app/components/documents/
git checkout -- app/hooks/
git checkout -- app/lib/services/

# 4. Restart portal with old configuration
npm run dev
```

## 📊 Success Metrics Verification

### Technical Success (Measurable)

- [ ] Portal bundle size < 500KB (from 1.8MB)
- [ ] Cross-domain navigation < 300ms
- [ ] Cross-worker error rate < 0.5%
- [ ] Documents worker can deploy independently
- [ ] Rollback procedures tested and work

### Business Success (Observable)

- [ ] User experience not degraded
- [ ] Template editing workflows work as before
- [ ] Team can work on documents domain independently
- [ ] Performance matches or exceeds previous state
- [ ] No increase in support tickets

## 🎯 Post-Migration Tasks

### Cleanup

```bash
# Remove moved components from portal
rm -rf app/components/documents/pdfme-designer*
rm -rf app/hooks/use-pdfme-designer*
rm -rf app/hooks/use-document-template-editor*

# Update TypeScript references
# Fix any remaining import errors

# Update documentation with actual implementation details
```

### Documentation Updates

- [ ] Update API documentation for documents worker
- [ ] Document new deployment procedures
- [ ] Create troubleshooting guide based on actual issues
- [ ] Update team onboarding materials

## 📞 Support & Troubleshooting

### During Migration Support

- **Primary Contact**: [Team Lead Name]
- **Secondary Contact**: [DevOps Engineer]
- **Monitoring Channel**: #engineering-alerts
- **Documentation**: `docs/domains/micro-frontend/`

### Common Issues Resolution

1. **Module Federation loading fails**: Check CORS, verify ports, clear cache
2. **API calls failing**: Verify WORKER_SHARED_SECRET, check ALLOWED_ORIGINS
3. **Performance issues**: Compare bundle sizes, check network waterfall
4. **Missing dependencies**: Check package.json, verify imports

## 🎉 Migration Complete Checklist

- [ ] All components moved to documents worker
- [ ] Portal integration working with federated components
- [ ] RPC APIs functioning correctly
- [ ] Testing complete (unit, integration, performance)
- [ ] Performance metrics meet targets
- [ ] Staging deployment verified
- [ ] Production rollout complete
- [ ] Documentation updated
- [ ] Team trained on new patterns
- [ ] Monitoring configured and alerts tested

---

**Migration Lead**: [Name]  
**Start Date**: [Date]  
**Target Completion**: [Date]  
**Estimated Effort**: 2-3 weeks (including testing)

**Ready to begin?** Start with **Phase 1, Step 1** by moving the PDFME components.
