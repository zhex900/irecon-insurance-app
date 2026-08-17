# Documentation Structure

This directory contains all project documentation organized by domain with consistent kebab-case naming conventions.

## Structure Overview

```
docs/
├── README.md                          # This file - overview of documentation structure
├── guidelines/                        # Coding and design guidelines
│   ├── coding-standards.md           # TypeScript, React, and clean code rules
│   ├── design-patterns.md            # Service, repository, mapper patterns
│   ├── ui-guidelines.md              # Design system, shadcn/ui, ReUI rules
│   ├── tooling.md                    # Lint, format, and development tools
│   ├── code-review.md                 # Code review process and checklists
│   └── organization-naming-standards.md # File and folder naming standards
├── architecture/                      # Architecture documentation
│   ├── performance.md                # Performance optimization and bundle management
│   └── refactor-to-production.md     # Production roadmap and refactoring guide
├── development/                       # Development workflow
│   ├── testing.md                    # Testing guidelines and strategies
│   ├── e2e-test-plan.md              # End-to-end testing plan
│   ├── email.md                      # Email handling and templates
│   └── testing/pdf-output-comparison-test-design.md # PDF testing design
├── deployment/                        # Deployment and monitoring
│   ├── observability.md              # Monitoring, Sentry, and error tracking
│   ├── preview-environments.md       # Per-PR Cloudflare + Supabase preview
│   └── monitoring-setup.md          # Monitoring system setup
├── domains/                           # Domain-specific documentation
│   ├── micro-frontend/               # Micro-frontend architecture
│   │   ├── README.md                 # Micro-frontend overview
│   │   ├── architecture.md          # Architecture design and decisions
│   │   ├── refactor-plan.md         # Implementation roadmap
│   │   └── deployment.md            # Deployment procedures
│   ├── pricing/                      # Pricing domain
│   │   ├── car-premium-formulas.md  # CAR insurance premium calculations
│   │   └── legacy-vs-rebuild-premium-manual.md # Legacy system comparisons
│   ├── security/                     # Security documentation
│   │   ├── code-review-worker-security-checklist.md
│   │   ├── worker-network-security-plan.md
│   │   ├── worker-organization-pattern.md
│   │   └── worker-security-implementation-plan.md
│   └── summary.md                    # Documentation structure summary
├── plans/                             # Implementation plans
│   ├── car-wizard-boolean-props-refactor.md
│   ├── edit-lock-leases.md
│   ├── excel-worker-optimization-plan.md
│   ├── pdf-pricing-file-splitting-refactor.md
│   ├── user-email.md
│   └── worker-bundle-optimization-plan.md
├── archive/                          # Archived/outdated documentation
│   ├── cleanup-summary.md
│   ├── implementation-summary.md
│   ├── micro-frontend-*.md (various archived files)
│   ├── microfrontend-*.md (various archived files)
│   └── module-federation-*.md (various archived files)
└── .temp/                            # Temporary files (code reviews, etc.)
    ├── CODE_REVIEW_2026-08-13.md
    └── CODE_REVIEW_2026-08-14.md
```

## Naming Convention

All documentation files now follow **kebab-case** naming (lowercase with hyphens) for consistency:

- ✅ `coding-standards.md` (correct)
- ✅ `ui-guidelines.md` (correct)
- ✅ `performance.md` (correct)
- ❌ `CODING_STANDARDS.md` (incorrect - UPPER_SNAKE_CASE)
- ❌ `UiGuidelines.md` (incorrect - PascalCase)
- ❌ `performance.MD` (incorrect - uppercase extension)

## How to Find Documentation

### Quick Access

| Documentation Type | Primary Location                                                              |
| ------------------ | ----------------------------------------------------------------------------- |
| Coding Standards   | `docs/guidelines/coding-standards.md`                                         |
| UI Guidelines      | `docs/guidelines/ui-guidelines.md`                                            |
| Performance        | `docs/architecture/performance.md`                                            |
| Testing            | `docs/development/testing.md`                                                 |
| Deployment         | `docs/deployment/observability.md`, `docs/deployment/preview-environments.md` |
| Architecture       | `docs/domains/micro-frontend/architecture.md`                                 |
| Plans              | `docs/plans/`                                                                 |

### Reference Documentation

For AI assistant guidance, refer to [AGENTS.md](../AGENTS.md) in the project root, which has been updated with the new documentation paths.

## Recent Reorganization

The documentation was reorganized on **Aug 14, 2026** to address:

1. **Inconsistent naming**: All files converted to kebab-case
2. **Poor organization**: Files grouped by domain/function
3. **Mixed content**: Guidelines separated from plans and implementation details
4. **Duplicate structures**: Archive folder consolidated

## Key Changes

- **Guidelines moved**: All coding/design guidelines in `docs/guidelines/`
- **Architecture separated**: Architecture documents in `docs/architecture/`
- **Development workflow**: Development docs in `docs/development/`
- **Domain grouping**: Domain-specific docs in `docs/domains/`
- **Consistent naming**: All files use kebab-case (lowercase-with-hyphens)

## Adding New Documentation

When adding new documentation:

1. **Choose the right folder** based on content type
2. **Use kebab-case** for file names (e.g., `new-feature-specification.md`)
3. **Update references** in related documents if needed
4. **Consider if it belongs** in an existing document vs. creating new

## Archive Policy

The `docs/archive/` folder contains outdated documentation that has been:

- Superseded by newer versions
- Consolidated into other documents
- No longer actively maintained

Refer to `docs/domains/summary.md` for details on what was archived and why.

---

_Last updated: Aug 14, 2026 - Documentation reorganization complete_
