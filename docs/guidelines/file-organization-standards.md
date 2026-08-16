# File Organization Standards

These standards define how files should be organized and named in the codebase, particularly for files with common prefixes or related functionality.

## Core Principles

1. **Logical Grouping:** Related files belong together
2. **Redundancy Reduction:** Avoid repetitive prefixes in filenames
3. **Scalability:** Organization should support growth
4. **Discovery:** Easy to find related functionality
5. **Consistency:** Follow established patterns

## Pattern: Grouping Files with Common Prefixes

### When to Apply
Apply this pattern when **2 or more files share the same prefix** (excluding `.spec`, `.test`, `.d.ts` files).

### Implementation Pattern
```
Before:
app/[type]/prefix-feature-a.ts
app/[type]/prefix-feature-b.ts

After:
app/[type]/prefix/
├── feature-a.ts
├── feature-b.ts
└── index.ts
```

### Examples

#### ✅ Hook Files
```typescript
// Before
app/hooks/use-document-template-editor-controller.ts
app/hooks/use-document-template-editor-fetcher.ts

// After
app/hooks/document-template-editor/
├── use-controller.ts
├── use-fetcher.ts
└── index.ts
```

#### ✅ Component Files
```typescript
// Before
app/components/document-template-editor.tsx
app/components/document-template-dialog.tsx

// After (if pattern applies)
app/components/document-template/
├── editor.tsx
├── dialog.tsx
└── index.ts
```

### Import Pattern Changes
```typescript
// Before
import { hook } from "~/hooks/use-prefix-feature-a";

// After  
import { hook } from "~/hooks/prefix/use-feature-a";
// or using index file
import { hook } from "~/hooks/prefix";
```

## Directory Structure Standards

### 1. Hooks Directory (`app/hooks/`)
- **Individual hooks:** Keep in root if unique prefix
- **Grouped hooks:** Move to `prefix/` directory when 2+ files share prefix
- **Naming:** `use-feature.ts` inside directory (prefix removed)
- **Index files:** Create for clean exports

### 2. Components Directory (`app/components/`)
- **Domain grouping:** Already well-organized by domain (clients, documents, policies, etc.)
- **Root components:** Keep in root if unique or domain-agnostic
- **Consider grouping:** When 2+ components share prefix and related functionality

### 3. Utility Directory (`app/lib/`)
- **Domain grouping:** Already organized (auth, pdf, zod, etc.)
- **Consistency:** Maintain consistent naming within domains
- **Grouping opportunity:** When utility files share functionality prefix

### 4. Services Directory (`app/lib/services/`)
- **Already organized:** Services are well-organized by domain
- **Focus:** Maintain `.service.ts` naming consistency
- **Grouping:** Typically not needed due to existing organization

## Implementation Guidelines

### Step-by-Step Refactoring Process

1. **Identification**
   ```bash
   # Find files with common prefixes in a directory
   cd app/hooks && ls -la use-*.ts | grep prefix
   ```

2. **Create Directory**
   ```bash
   mkdir -p app/hooks/prefix-name
   ```

3. **Move and Rename Files**
   ```bash
   # Move and rename removing redundant prefix
   mv use-prefix-feature-a.ts prefix-name/use-feature-a.ts
   mv use-prefix-feature-b.ts prefix-name/use-feature-b.ts
   ```

4. **Create Index File**
   ```typescript
   // app/hooks/prefix-name/index.ts
   export { featureA } from "./use-feature-a";
   export { featureB } from "./use-feature-b";
   export type { FeatureAType } from "./use-feature-a";
   ```

5. **Update Imports**
   - Search for all import references
   - Update to new paths
   - Use TypeScript to verify correctness

6. **Verify Functionality**
   - Run `npm run typecheck`
   - Run tests if applicable
   - Manual testing if needed

### When NOT to Apply This Pattern

1. **Single files** with unique prefixes
2. **Test files** (`.spec.ts`, `.test.ts`) - keep with source files
3. **Type definition files** (`.d.ts`) - keep with source files
4. **Configuration files** - follow existing patterns
5. **When grouping creates confusion** rather than clarity

## Code Review Checklist

When reviewing file organization changes:

### ✅ Must Have
- [ ] 2+ files with same prefix before grouping
- [ ] Directory created with appropriate name
- [ ] Files renamed removing redundant prefix
- [ ] Index file created for clean exports
- [ ] All imports updated correctly
- [ ] TypeScript compilation successful
- [ ] No functionality regressions

### ✅ Should Have
- [ ] Clear benefit to organization
- [ ] Consistent with existing patterns
- [ ] Documentation updated if needed
- [ ] Team consensus for significant changes

### ✅ Could Have
- [ ] Tests updated if applicable
- [ ] Additional related files considered for grouping
- [ ] Pattern documented for future use

## Examples in This Codebase

### Successfully Implemented

#### Hook Files
- **Before:** `use-document-template-editor-controller.ts`, `use-document-template-editor-fetcher.ts`
- **After:** `document-template-editor/use-controller.ts`, `document-template-editor/use-fetcher.ts`
- **Benefit:** Cleaner organization, semantic imports

#### Pattern Reuse
This pattern can be applied to:
- Component files with common prefixes
- Utility files with shared functionality
- Service adjunct files (helpers, types)

## Tooling Support

### Scripts for Identification
```bash
# Find files with common prefixes in directory
find app/hooks -name "*.ts" | xargs -I {} basename {} | sed 's/^use-//' | sed 's/\.[^.]*$//' | sort | uniq -c | sort -rn
```

### Git Operations
```bash
# Stage refactoring changes
git add app/hooks/prefix-name/

# Commit with descriptive message
git commit -m "refactor(hooks): group prefix-name hooks
- Move use-prefix-feature-a -> prefix-name/use-feature-a
- Move use-prefix-feature-b -> prefix-name/use-feature-b  
- Update imports in consuming files"
```

## Maintenance Guidelines

### Adding New Files
1. **Check for existing prefixes** in the directory
2. **Follow pattern** if 2+ files will share prefix
3. **Use index exports** for clean public API

### Modifying Existing Groups
1. **Add files** to existing directories when sharing prefix
2. **Update index file** to export new functionality
3. **Communicate changes** to team if significant

### Proactive Monitoring System
We have established a proactive monitoring system for hook file organization. See [Hook File Creation Monitoring](hook-file-monitoring.md) for:

1. **Monitoring scripts** (`scripts/check-hook-grouping.sh`)
2. **Integration workflows** (git hooks, CI, code review)
3. **Decision flows** for new hook creation
4. **Refactoring checklists** for fixing issues

### Periodic Audits
1. **Daily:** Automated checks during development
2. **Weekly:** Team sync reviews organization status
3. **Monthly:** Full codebase scan with script
4. **Quarterly:** Review monitoring effectiveness and update patterns

## FAQs

### Q: What if files share prefix but aren't related?
**A:** Only group files with functional relationship, not just naming coincidence.

### Q: Should test files be moved with source files?
**A:** No, keep test files with their source files for discoverability.

### Q: What about deeply nested directories?
**A:** Avoid nesting beyond 3 levels. Prioritize flat structure where possible.

### Q: How handle namespace conflicts?
**A:** Find unique names within directory. Consider broader context if needed.

---

**Last Updated:** August 16, 2026  
**Based On:** Successful hook refactoring implementation  
**Next Review:** Quarterly or as patterns evolve