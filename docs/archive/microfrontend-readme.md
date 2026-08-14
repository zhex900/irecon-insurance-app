# Micro Frontend Architecture Documentation

## Overview

Domain-driven micro frontend architecture using Module Federation to transform the monolith insurance app into independently deployable domains.

## Quick Start

### 1. Review Architecture Decision

```bash
# First, understand the decision process
docs/microfrontend-decisions-guide.md
```

### 2. Module Federation Implementation

```bash
# Main refactor plan
docs/module-federation-refactor-plan.md

# Architecture details
docs/module-federation-architecture.md
```

### 3. Performance Analysis

```bash
# Impact on performance
docs/microfrontend-performance-impact.md
```

## Document Structure

### 📋 Planning & Strategy

- **`docs/microfrontend-decisions-guide.md`** - Critical architecture decisions
- **`docs/module-federation-refactor-plan.md`** - Step-by-step refactor plan
- **`docs/micro-frontend-architecture.md`** - Original architecture overview

### 🏗️ Implementation Details

- **`docs/module-federation-architecture.md`** - Module Federation design
- **`docs/micro-frontend-implementation-guide.md`** - Comprehensive implementation guide
- **`docs/micro-frontend-poc.md`** - Proof of concept details

### 📊 Performance & Monitoring

- **`docs/microfrontend-performance-impact.md`** - Performance analysis & optimization
- **`docs/micro-frontend-summary.md`** - Complete implementation summary

### 📈 Success Metrics

- **`docs/performance.md`** - Current performance guidelines
- **`scripts/analyze-bundle.sh`** - Bundle analysis script
- **`scripts/deploy-microfrontends.sh`** - Deployment automation

## Implementation Roadmap

### Phase 0: Foundation (Week 1)

```bash
# 1. Review current bundle analysis
./scripts/analyze-bundle.sh

# 2. Read decision guide
docs/microfrontend-decisions-guide.md

# 3. Set up Module Federation foundation
docs/module-federation-refactor-plan.md#phase-0
```

### Phase 1: Documents Domain (Weeks 2-3)

```bash
# Extract PDF-heavy Documents domain
docs/module-federation-refactor-plan.md#phase-1
```

### Phase 2: Optimization (Week 4)

```bash
# Implement shared dependencies, caching, monitoring
docs/module-federation-refactor-plan.md#phase-2
```

### Phase 3: Admin Domain (Weeks 5-6)

```bash
# Extract Admin domain
docs/module-federation-refactor-plan.md#phase-3
```

### Phase 4: Production Ready (Weeks 7-10)

```bash
# Advanced optimization & monitoring
docs/module-federation-refactor-plan.md#phase-4-phase-5
```

## Key Architecture Decisions

### 1. Domain-Based Separation

```
Insurance App Domains:
├── Portal (Core Shell)
├── Documents (PDF Heavy)      - FIRST TO EXTRACT
├── Admin (Configuration)       - SECOND
└── Reports (Excel Heavy)      - FUTURE
```

### 2. Module Federation Strategy

- **Start with Documents domain** for biggest bundle reduction
- **Use Module Federation** for seamless React integration
- **Keep iframe fallback** for error resilience

### 3. Shared Dependencies Strategy

```typescript
// Shared Singletons (loaded once)
react, react-dom, react-router, tanstack-query

// Isolated Domains (domain-specific)
@pdfme/ui → Documents only
@tiptap/core → Documents only
exceljs → Reports only
```

## Success Criteria

### Technical Success

1. **Bundle size**: Portal < 500KB (from 1.88MB)
2. **Navigation**: < 300ms between domains
3. **Error rate**: < 0.5% cross-domain errors
4. **Deployment time**: < 1 minute per domain

### Business Success

1. **Development velocity**: Teams work independently
2. **User experience**: No degradation
3. **Scalability**: Independent scaling per domain
4. **Maintainability**: Clear domain boundaries

## Risk Mitigation

### Immediate Risks

1. **Performance degradation** → Iframe fallback + preloading
2. **Cross-domain errors** → Circuit breaker pattern
3. **Team learning curve** → Training + pairing sessions
4. **Deployment complexity** → Automated scripts

### Rollback Strategy

```bash
# Single command rollback
./scripts/rollback-federation.sh --domain documents --reason "performance"
```

## Team Responsibilities

### Architecture Team

- Design Module Federation implementation
- Establish shared dependency strategy
- Create monitoring & metrics
- Implement rollback procedures

### Documents Domain Team (First)

- Extract PDFME/TiTap components
- Implement DocumentDesigner federation
- Set cross-domain communication patterns
- Test with real users

### DevOps Team

- Create deployment automation
- Set up monitoring dashboards
- Implement canary deployment
- Establish CI/CD pipelines

## Next Steps

### Immediate (Next 2 days)

1. **Review decision guide** with team
2. **Set performance baseline** metrics
3. **Create Module Federation foundation**
4. **Extract first component** (DocumentDesigner)

### Week 1 Goals

1. **Documents domain extraction complete**
2. **Performance metrics showing improvement**
3. **Team comfortable with Module Federation**
4. **Rollback procedure tested**

## Need Help?

### Common Issues

- **Module loading slow**: Check preloading strategy
- **Cross-domain state issues**: Review event bus implementation
- **Bundle size not reducing**: Verify dependency isolation
- **Deployment failures**: Use automated rollback

### Support Resources

1. **Module Federation docs**: `/docs/module-federation-architecture.md`
2. **Performance troubleshooting**: `/docs/microfrontend-performance-impact.md`
3. **Deployment scripts**: `/scripts/` directory
4. **Team training**: Schedule architecture review sessions

## Contributing

### Documentation Updates

When making changes to the architecture:

1. Update the relevant document
2. Update the README links if needed
3. Notify team of changes
4. Update deployment scripts if affected

### Add New Domains

When adding a new domain:

1. Follow phase structure from refactor plan
2. Document domain responsibilities
3. Update compatibility matrix
4. Add to deployment automation

---

**Ready to start?** Begin with **Phase 0** in `docs/module-federation-refactor-plan.md`
