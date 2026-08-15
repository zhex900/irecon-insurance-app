# PDFME Dependency Migration Analysis

## Current State Analysis

### Heavy Dependencies Analysis
- **@pdfme/ui**: 24MB (main UI library)
- **@pdfme/converter**: 12MB 
- **@pdfme/pdf-lib**: 2.5MB
- **@pdfme/schemas**: 1.2MB
- **@pdfme/common**: 724KB
- **@pdfme/generator**: Dynamically imported (not in main bundle)

### PDFME Import Analysis (35 files total)

#### 1. Type Only Imports (Safe to keep in Portal)
```typescript
// These only import types and can stay in Portal
import type { Template } from "@pdfme/common";
import type { Font } from "@pdfme/common";
import type { Plugin, PropPanelWidgetProps, Schema } from "@pdfme/common";
```

**Files with type-only imports (15 files)**:
- `app/lib/services/documents/document-templates.ts`
- `app/lib/pdf/html-rich-text-draw.ts`
- `app/hooks/use-pdfme-designer-actions.ts`
- `app/lib/pdf/template-changelog.ts`
- `workers/pdf/fonts.ts`
- `app/lib/pdf/sample-merge-inputs.ts`
- `app/lib/pdf/flow-push-down.ts`
- `app/lib/pdf/extract-base-pdf-rectangles.ts`
- `app/lib/pdf/bulk-format.ts`
- `app/lib/documents/template-editor-types.ts`
- `app/lib/documents/template-editor-form.ts`
- `app/lib/documents/template-editor-autosave.ts`
- `app/hooks/use-document-template-editor-fetcher.ts`
- `app/hooks/use-document-template-editor-controller.ts`
- `app/components/documents/pdfme-designer.tsx`

#### 2. Runtime Imports (Need to migrate to Documents Worker)
```typescript
// These import runtime modules and need to move
import { multiVariableText, text } from "@pdfme/schemas";
import { getDefaultFont } from "@pdfme/common";
import { image, line, rectangle, table } from "@pdfme/schemas";
import { isBlankPdf } from "@pdfme/common";
```

**Files with runtime imports (20 files)**:
1. **@pdfme/schemas imports (7 files)**:
   - `app/lib/pdf/text-plugins.ts`
   - `app/lib/pdf/plugins.ts`

2. **@pdfme/ui imports (2 files)**:
   - `app/hooks/use-pdfme-designer-lifecycle.ts`
   - `app/components/documents/pdfme-designer-helpers.ts`

3. **@pdfme/generator imports (3 files - dynamic)**:
   - `app/lib/pdf/generate.ts` (dynamic import)
   - `app/hooks/use-document-template-preview.ts` (dynamic import)
   - `tests/integration/pdf-output-comparison.test.ts` (mock)

4. **@pdfme/common runtime imports (8 files)**:
   - `app/lib/services/documents/document-templates.ts` (isBlankPdf)
   - `app/lib/pdf/endorsement-expand.ts` (isBlankPdf)
   - `workers/pdf/fonts.ts` (getDefaultFont)
   - `app/lib/pdf/fonts.ts` (getDefaultFont)
   - Other misc runtime imports

### Component Dependency Analysis

#### 1. PDFME Core Components
```
📦 PDF Template Editor Component Tree:
├── PdfmeDesigner.tsx (main component)
├── use-pdfme-designer-lifecycle.ts (UI instance management)
├── use-pdfme-designer-actions.ts (actions/handlers)
├── pdfme-designer-helpers.ts (schema utilities)
├── document-template-editor.tsx (wrapper)
└── Related hooks (4 hooks total)
```

#### 2. PDF Generation Components
```
📦 PDF Generation Component Tree:
├── generate.ts (PDF generation with @pdfme/generator)
├── fonts.ts (font management with @pdfme/common)
├── text-plugins.ts (custom schemas with @pdfme/schemas)
├── plugins.ts (additional schemas with @pdfme/schemas)
└── Related utilities (8 files total)
```

## Migration Strategy

### Phase 1: Create Documents Worker Template
1. **Copy template**: `cp -r workers/_template workers/documents`
2. **Update domain name**: Replace `_template` with `documents`
3. **Add PDFME dependencies**: Install `@pdfme/ui`, `@pdfme/generator`, `@pdfme/schemas`, `@pdfme/common`

### Phase 2: Migrate Components by Category

#### Category A: Keep in Portal (Type-only imports)
- These files only need type definitions
- Solution: Keep type imports, extract runtime logic to Documents worker
- Create shared type definitions in `federation/shared-types/`

#### Category B: Move to Documents Worker (Runtime imports)
1. **Primary components**:
   - `PdfmeDesigner.tsx` → `workers/documents/src/components/`
   - PDFME hooks → `workers/documents/src/hooks/`
   - Helper utilities → `workers/documents/src/utils/`

2. **PDF generation utilities**:
   - `generate.ts` logic → `workers/documents/services/pdf-generation.ts`
   - Font utilities → `workers/documents/services/font-management.ts`

#### Category C: Split Implementation
1. **Keep types and contracts in Portal**:
   - `app/lib/documents/template-editor-types.ts`
   - `app/lib/documents/template-editor-form.ts`
   - Worker communication contracts

2. **Move implementation to Documents worker**:
   - Runtime schema parsing
   - UI component rendering
   - PDF generation logic

### Phase 3: Create Integration Layer

#### 1. Cross-Domain Communication
- Create `DocumentDesigner` export in `workers/documents/src/exports.ts`
- Implement `FederatedDocumentDesigner` wrapper in Portal
- Set up Module Federation configuration

#### 2. Shared State Management
- Define shared types for templates
- Create event-based sync for template changes
- Implement fallback mechanisms

#### 3. Type Sharing Strategy
```typescript
// In Portal: Shared types only
export type { Template, Font, Schema } from "@pdfme/common";

// In Documents Worker: Full implementation
import type { Template } from "@pdfme/common";
import { generate } from "@pdfme/generator";
import { Designer } from "@pdfme/ui";
```

## Technical Considerations

### 1. Bundle Size Impact
- **Current Portal bundle**: ~24MB PDFME dependencies
- **Target Portal bundle**: ~0.5MB (type definitions only)
- **Documents Worker bundle**: ~0.8MB (PDFME + domain logic)

### 2. Type Compatibility
- Keep `@pdfme/common` type definitions in both
- Use minimal type imports in Portal
- Ensure type compatibility across domains

### 3. Module Federation Configuration
```typescript
// Portal Vite config
federation({
  remotes: {
    documents: "documents@http://localhost:5175/remoteEntry.js",
  },
  shared: {
    react: { singleton: true },
    "react-dom": { singleton: true },
  },
});

// Documents Vite config  
federation({
  name: "documents",
  exposes: {
    "./DocumentDesigner": "./src/exports/DocumentDesigner.tsx",
  },
});
```

### 4. Development Experience
- Concurrent development servers
- Hot module replacement across domains
- Shared TypeScript configuration

## Migration Priority Order

### Priority 1: Core PDF Editor (Week 1)
1. `PdfmeDesigner.tsx` and related hooks
2. PDFME UI lifecycle management
3. Basic template editing functionality

### Priority 2: PDF Generation (Week 2)
1. PDF generation utilities
2. Font management
3. Schema plugins

### Priority 3: Integration & Optimization (Week 3)
1. Cross-domain state sync
2. Performance optimization
3. Error handling and fallbacks

### Priority 4: Advanced Features (Week 4)
1. Advanced schema plugins
2. Template versioning
3. Bulk operations

## Risk Assessment

### Low Risk (Type-only imports)
- Keep type definitions in Portal
- No runtime dependencies
- Easy to migrate incrementally

### Medium Risk (Light runtime utilities)
- Minor dependencies like `isBlankPdf`
- Can be replaced with custom implementations
- Limited impact if migration fails

### High Risk (Heavy UI/GUI)


- `@pdfme/ui` (24MB)
- `@pdfme/generator` (dynamic but heavy)
- Requires comprehensive testing
- Fallback to iframe if Module Federation fails

## Testing Strategy

### 1. Unit Tests
- Test type compatibility
- Test individual component migration
- Verify no broken imports

### 2. Integration Tests
- Test cross-domain communication
- Verify Module Federation loading
- Test error recovery

### 3. Performance Tests
- Measure bundle size reduction
- Test cold start improvements
- Monitor memory usage

## Fallback Strategies

### 1. If Module Federation Fails
```typescript
// Fallback to iframe
function FallbackDocumentDesigner() {
  return (
    <iframe
      src="https://documents-worker/documents/designer"
      className="w-full h-full"
    />
  );
}
```

### 2. If State Sync Fails
```typescript
// Manual sync option
function ManualTemplateSync({ templateId }) {
  const [needsSync, setNeedsSync] = useState(false);
  
  return (
    <Alert>
      Template changes need manual synchronization
      <Button onClick={syncTemplate}>Sync Now</Button>
    </Alert>
  );
}
```

### 3. If Performance Degrades
```typescript
// Progressive enhancement
if (performance.memory < MINIMUM_MEMORY) {
  // Load lighter version
  import("./DocumentDesignerLite");
} else {
  // Load full version  
  import("./DocumentDesigner");
}
```

## Success Metrics

### Quantitative
- Portal bundle reduction: 50%+ target
- Cross-domain latency: < 300ms
- Error rate: < 0.5%

### Qualitative
- User experience unchanged or improved
- Development team productivity maintained
- Deployment independence achieved

## Next Steps

1. **Create Documents worker from template**
2. **Migrate Priority 1 components**
3. **Test basic integration**
4. **Measure initial bundle impact**
5. **Iterate based on results**