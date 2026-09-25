# PDF Template Editor Worker Architecture

## Executive Summary

The PDF Template Editor Worker Architecture establishes a micro-frontend pattern for isolating heavy PDFME dependencies (~40MB) into a dedicated Cloudflare Worker, reducing Portal bundle size by ~73% while enabling independent deployment and team autonomy.

## Table of Contents

1. [Architectural Goals](#architectural-goals)
2. [Current Analysis](#current-analysis)
3. [Architecture Design](#architecture-design)
4. [Implementation Phases](#implementation-phases)
5. [Technical Specifications](#technical-specifications)
6. [Success Metrics](#success-metrics)
7. [Risk Mitigation](#risk-mitigation)
8. [Next Steps](#next-steps)

## Architectural Goals

### Primary Objectives

1. **Bundle Size Reduction**: Isolate ~24MB PDFME UI library from Portal Worker
2. **Standard Pattern**: Create reusable pattern for future domain extractions
3. **Independent Deployment**: Enable separate deployment of PDF editor
4. **Improved Performance**: Faster cold starts for Portal Worker
5. **Team Autonomy**: Allow Documents team to own their tech stack

### Secondary Benefits

- **Faster cold starts**: Portal Worker starts ~62.5% faster without PDFME
- **Isolated failures**: PDF editor crashes won't affect Portal
- **Scalable architecture**: Pattern reusable for Admin, Reports, Analytics domains
- **Development autonomy**: Documents team can iterate independently

## Current Analysis

### Bundle Size Analysis

```
PDF Libraries Total: ~40MB
├── @pdfme/ui: 24MB
├── @pdfme/converter: 12MB
├── @pdfme/pdf-lib: 2.5MB
├── @pdfme/schemas: 1.2MB
└── @pdfme/common: 724KB

Current Portal Bundle: ~1.8MB (includes PDFME)
Target Portal Bundle: ~400KB (79% reduction)
Target Documents Worker: ~800KB

Import Analysis: 35 files with PDFME imports
- Type-only imports: 15 files (can stay in Portal)
- Runtime imports: 20 files (need to migrate)
```

### Component Dependency Mapping

```
📦 PDF Template Editor Component Tree
├── Primary Components
│   ├── PdfmeDesigner.tsx (main editor)
│   ├── use-pdfme-designer-lifecycle.ts (UI lifecycle)
│   ├── use-pdfme-designer-actions.ts (action handlers)
│   └── pdfme-designer-helpers.ts (schema utilities)
├── Supporting Components
│   ├── Document template editor wrapper
│   ├── Merge panels and toolbars
│   └── Preview components
└── PDF Generation Layer
    ├── generate.ts (PDF generation)
    ├── fonts.ts (font management)
    ├── text-plugins.ts (custom schemas)
    └── plugins.ts (additional schemas)
```

## Architecture Design

### High-Level Architecture

```
┌─────────────────────┐      Module Federation       ┌─────────────────────┐
│     Portal Worker   │◄─────────────────────────────►│  Documents Worker   │
│                     │        Cross-Domain           │                     │
│ ├─ 400KB Bundle     │        Communication          │ ├─ 800KB Bundle     │
│ │   (Light UI)      │                               │ │   (PDF Heavy)     │
│ │                   │                               │ │                   │
│ ├─ Components:      │                               │ ├─ Components:      │
│ │   • Navigation    │                               │ │   • PDF Editor    │
│ │   • Auth/Session  │                               │ │   • PDF Preview   │
│ │   • Template List │                               │ │   • Fonts/Plugins │
│ │                   │                               │ │   • TiTap Editor  │
│ └─ Module Federation│                               │ └─ Exports:         │
│     • Loader        │                               │     DocumentDesigner│
│     • Error Boundary│                               │     PDFPreview      │
│     • State Sync    │                               └─────────────────────┘
└─────────────────────┘
```

### Cross-Domain Communication Patterns

#### 1. Module Federation Integration

```
Portal → Module Federation → Documents Worker
          ├── FederatedComponent (loader)
          ├── Error Boundary (fallback)
          └── State Synchronization
```

#### 2. Event-Based Communication

```
Portal                     Documents Worker
   │                              │
   ├── TEMPLATE_SYNC ────────────►│ (template created/updated/deleted)
   │                              │
   ├── MERGE_FIELD_SYNC ─────────►│ (merge field changes)
   │                              │
   ├── DOCUMENT_GEN_REQUEST ─────►│ (PDF generation)
   │                              │
   └── HEALTH_CHECK ─────────────►│ (connection monitoring)
```

#### 3. State Synchronization

```
Portal State ↔ Cross-Domain State Manager ↔ Documents State
       │               │                     │
       ├─ Template Cache                    │
       ├─ Merge Fields                      │
       └─ User Preferences                  │
```

## Implementation Phases

### Phase 1: Foundation & Patterns (Week 1-2)

#### 1.1 Standard Worker Template

- **Template Location**: `workers/_template/`
- **Structure**:
  ```
  workers/_template/
  ├── package.json                    # Domain dependencies
  ├── vite.config.ts                  # Module Federation config
  ├── wrangler._template.jsonc        # Worker config template
  ├── index.ts                        # Worker API entry
  └── src/
      ├── exports/                    # Federated exports
      ├── components/                 # Domain components
      ├── hooks/                       # Domain hooks
      └── utils/                       # Domain utilities
  ```

#### 1.2 PDFME Dependency Analysis

- **File**: `docs/migration/pdfme-dependencies.md`
- **Content**: Comprehensive migration guide categorizing:
  - Type-only imports (keep in Portal)
  - Runtime imports (migrate to Documents)
  - Dependency priority order
  - Migration risk assessment

#### 1.3 Cross-Domain Communication Framework

- **Contract**: `app/lib/pdf/document-worker-contract.ts`
  - Type-safe API interfaces
  - Event schemas (TemplateSync, MergeFieldSync, etc.)
  - Request/response patterns
- **State Management**: `federation/state/cross-domain-state.ts`
  - Eventual consistency model
  - Conflict resolution strategies
  - Subscription patterns
- **Event Bus**: `federation/communication/event-bus.ts`
  - Retry logic with exponential backoff
  - Heartbeat monitoring
  - Connection management

### Phase 2: Documents Worker Implementation (Week 3-4)

#### 2.1 Documents Worker Creation

- **Command**: `./tools/create-worker-domain.sh documents`
- **Result**: `workers/documents/` with configured:
  - Module Federation exports (DocumentDesigner, PDFPreview)
  - Vite configuration for micro-frontend
  - Wrangler deployment configuration

#### 2.2 Component Migration Strategy

**Priority 1 (Week 3): Core Editor**

- `PdfmeDesigner.tsx` → `workers/documents/src/components/DocumentDesigner.tsx`
- PDFME UI lifecycle hooks
- Basic template editing functionality

**Priority 2 (Week 4): PDF Generation**

- PDF generation utilities
- Font management services
- Schema plugins and extensions

**Priority 3 (Week 5): Integration Layer**

- Cross-domain state synchronization
- Error recovery mechanisms
- Performance optimization

#### 2.3 Federated Integration Layer

- **Component**: `FederatedDocumentDesigner.tsx`
  - Module Federation integration
  - Loading states and skeleton UI
  - Error boundaries with fallback options
- **Loader**: `federated-component.tsx`
  - Dynamic module loading with timeout
  - Retry logic for failed loads
  - Preloading based on user intent

#### 2.4 Portal Configuration Updates

- **Shared Dependencies**: `federation/shared-deps.ts`
  - React, React DOM singletons
  - Excluded PDFME dependencies
  - Development/production configurations
- **Vite Federation Config**: Integration with Portal build system

### Phase 3: Testing & Optimization (Week 5-6)

#### 3.1 Development Environment

```
Development Commands:
├── Portal only: `npm run dev`
├── Documents only: `cd workers/documents && npm run dev`
└── Combined: `npm run dev:federation`
```

#### 3.2 Performance Testing Suite

- **Bundle Analysis**: `scripts/bundle/analyze-bundle.sh`
- **Cold Start Measurement**: Portals vs Documents worker
- **Cross-Domain Latency**: Event bus communication timing
- **Memory Usage**: Before/after isolation comparison

#### 3.3 Integration Testing Scenarios

1. **Template Editing Flow**
   - Portal loads DocumentDesigner via Federation
   - Template changes sync across domains
   - PDF preview updates in real-time

2. **Error Recovery**
   - Module Federation failure falls back to iframe
   - Network interruptions gracefully handled
   - State recovery on reconnection

3. **Performance Impact**
   - No user-visible degradation
   - Maintained or improved response times
   - Consistent user experience

### Phase 4: Production Readiness (Week 7-8)

#### 4.1 Deployment Pipeline

```
Deployment Commands:
├── Develop: Local development servers
├── UAT: Feature flags and canary rollouts
├── Production: Automated deployment with rollback
└── Monitoring: Performance dashboards and alerts
```

#### 4.2 Monitoring & Observability

- **Cross-Domain Tracing**: Request IDs across Portal/Documents
- **Performance Metrics**: Load times, error rates, bundle sizes
- **User Experience**: Performance monitoring with synthetic checks
- **Alerting**: Automated alerts for degradation or failures

#### 4.3 Team Documentation

- **Migration Guide**: Step-by-step domain extraction
- **Troubleshooting**: Common issues and solutions
- **Performance Patterns**: Optimization techniques
- **Team Handoff**: Domain ownership and responsibilities

## Technical Specifications

### Module Federation Configuration

#### Portal Configuration

```typescript
// vite.config.federation.ts
federation({
  remotes: {
    documents: "documents@http://localhost:5175/remoteEntry.js",
  },
  shared: sharedDependencies,
});
```

#### Documents Worker Configuration

```typescript
// workers/documents/vite.config.ts
federation({
  name: "documents",
  exposes: {
    "./DocumentDesigner": "./src/exports/DocumentDesigner.tsx",
    "./PDFPreview": "./src/exports/PDFPreview.tsx",
  },
  shared: {
    react: { singleton: true },
    "react-dom": { singleton: true },
  },
});
```

### Shared Dependencies Strategy

#### Shared Singletons (Loaded Once)

```
✅ React, React DOM
✅ React Router
✅ @tanstack/react-query
✅ @supabase/supabase-js
✅ reui UI library
✅ shadcn/ui components
```

#### Documents-Specific (Isolated)

```
⏹️ @pdfme/ui, @pdfme/generator
⏹️ @tiptap/core, @tiptap/react
⏹️ PDF generation utilities
⏹️ Font management systems
```

### Error Handling Architecture

#### Fallback Hierarchy

1. **Primary**: Module Federation dynamic import
2. **Fallback 1**: Retry with exponential backoff (3 attempts)
3. **Fallback 2**: Simplified component version
4. **Fallback 3**: Iframe with standalone Documents worker
5. **Fallback 4**: Static error message with refresh option

#### Error Types Handled

- Module load failures (network, version mismatch)
- Cross-domain communication errors
- State synchronization conflicts
- Resource constraints (memory, timeout)

### State Synchronization Patterns

#### Eventual Consistency Model

```
┌───────────┐     Broadcast    ┌───────────┐
│   Portal  │◄────────────────►│ Documents │
└───────────┘   State Updates  └───────────┘
       │                              │
       └───────► Cache Layer ◄────────┘
```

#### Conflict Resolution Strategies

1. **Last Write Wins**: Timestamp-based resolution
2. **Manual Merge**: User intervention required
3. **Version Tracking**: State versioning with conflict detection
4. **Rollback Points**: Automatic recovery points

## Success Metrics

### Quantitative Metrics

| Metric               | Current | Target   | Improvement       |
| -------------------- | ------- | -------- | ----------------- |
| Portal Bundle Size   | 1.8MB   | 400KB    | 78%               |
| Cold Start Time      | 800ms   | 300ms    | 63%               |
| Cross-Domain Latency | N/A     | <300ms   | N/A               |
| Error Rate           | N/A     | <0.5%    | N/A               |
| Memory Consumption   | Shared  | Isolated | Failure isolation |

### Qualitative Metrics

1. **User Experience**: No degradation in editor functionality
2. **Development Velocity**: Independent team deployment capability
3. **System Reliability**: Isolated failures, no cascading crashes
4. **Team Autonomy**: Documents team controls their tech stack

### Measurement Tools

- **Bundle Analysis**: `scripts/bundle/analyze-bundle.sh`
- **Performance Monitoring**: Custom dashboard with real-time metrics
- **Error Tracking**: Sentry integration with cross-domain tracing
- **User Feedback**: In-app surveys and performance monitoring

## Risk Mitigation

### Technical Risks

#### 1. Cross-Domain Latency

**Mitigation**:

- Request batching for multiple operations
- Connection pooling and keep-alive
- Local caching with TTL strategies
- Progressive loading and optimistic updates

**Fallback**: If latency >500ms, show loading states with progress indication

#### 2. State Synchronization Failures

**Mitigation**:

- Eventual consistency with manual override
- Conflict detection and resolution strategies
- Offline mode with sync-on-reconnect
- Audit trails for manual reconciliation

**Fallback**: Manual sync button with conflict resolution UI

#### 3. Module Federation Complexity

**Mitigation**:

- Start with iframe fallback (progressive enhancement)
- Comprehensive integration testing
- Detailed debugging tools and logs
- Team training and pair programming

**Fallback**: Iframe embedding with full Documents worker UI

#### 4. Bundle Size Reduction Not Achieved

**Mitigation**:

- Incremental migration with measurement at each step
- Dependency analysis and tree shaking
- Code splitting within Documents worker
- Asset optimization and compression

**Fallback**: Partial extraction focusing on heaviest dependencies

### Operational Risks

#### 1. Team Skills Gap

**Mitigation**:

- Comprehensive documentation with examples
- Pair programming sessions with architecture team
- Gradual rollout with increasing complexity
- Dedicated support channels and office hours

**Fallback**: Extended timeline with additional training

#### 2. Deployment Coordination

**Mitigation**:

- Automated CI/CD pipelines
- Feature flags for gradual rollout
- Automated rollback procedures
- Staged deployment with monitoring

**Fallback**: Manual deployment coordination with checkpoint reviews

#### 3. Monitoring Fragmentation

**Mitigation**:

- Unified observability dashboard
- Cross-domain tracing with shared request IDs
- Automated alerting with escalation paths
- Regular performance reviews

**Fallback**: Manual correlation of logs and metrics

#### 4. User Experience Degradation

**Mitigation**:

- A/B testing with performance metrics
- Feature flags for rollback capability
- User feedback loops and surveys
- Performance monitoring with user-centric metrics

**Fallback**: Rollback to monolith if metrics degrade beyond threshold

## Dependencies & Prerequisites

### Required Tools

| Tool                    | Purpose                            | Version  |
| ----------------------- | ---------------------------------- | -------- |
| @module-federation/vite | Module Federation integration      | ^3.0.5   |
| Cloudflare Workers      | Worker deployment platform         | Latest   |
| Sentry                  | Error monitoring and observability | ^10.70.0 |
| Vite                    | Build tool with Federation support | ^5.4.11  |
| Wrangler                | Worker development/deployment      | ^4.120.0 |

### Team Resources

| Role                  | Responsibilities                             | Time Commitment |
| --------------------- | -------------------------------------------- | --------------- |
| Architecture Team     | Foundation patterns, Module Federation setup | 20% (ongoing)   |
| Documents Domain Team | Component migration, testing                 | 50% (Phase 2-3) |
| DevOps Team           | Deployment automation, monitoring            | 30% (Phase 4)   |
| QA Team               | Cross-domain testing, performance validation | 20% (Phase 3-4) |

### Infrastructure Requirements

1. **Development Environment**: Concurrent Portal + Documents worker servers
2. **UAT environment**: Separate deployment for Documents worker
3. **Monitoring**: Cross-domain tracing and performance dashboards
4. **CI/CD**: Automated testing and deployment pipelines

## Next Steps

### Immediate Actions (Week 1)

1. **Architecture Review**: Team alignment on approach and patterns
2. **Documentation Finalization**: Review and approve migration guide
3. **Environment Setup**: Development environment for concurrent workers
4. **Performance Baseline**: Measure current bundle sizes and load times

### Short-Term Actions (Week 2-3)

1. **Documents Worker Creation**: Instantiate from template
2. **Core Component Migration**: Move PdfmeDesigner and basic functionality
3. **Integration Testing**: Verify cross-domain communication
4. **Performance Measurement**: Initial bundle reduction validation

### Medium-Term Actions (Week 4-6)

1. **Complete Component Migration**: All PDFME dependencies to Documents
2. **Advanced Integration**: State sync, error handling, optimization
3. **UAT deployment**: Feature-flagged deployment to UAT
4. **User Testing**: Validate no degradation in user experience

### Long-Term Actions (Week 7-10)

1. **Production Deployment**: Gradual rollout to production users
2. **Monitoring Optimization**: Fine-tune alerts and performance monitoring
3. **Documentation Finalization**: Complete cookbook and troubleshooting guides
4. **Pattern Generalization**: Extract lessons for future domain extractions

### Success Criteria Checkpoints

| Phase   | Checkpoint             | Success Criteria                                    |
| ------- | ---------------------- | --------------------------------------------------- |
| Phase 1 | Architecture Review    | Team approves patterns and approach                 |
| Phase 2 | Initial Integration    | Portal loads DocumentDesigner from Documents worker |
| Phase 3 | Performance Validation | Bundle reduction >50%, no UX degradation            |
| Phase 4 | Production Readiness   | Independent deployment, comprehensive monitoring    |

## Conclusion

The PDF Template Editor Worker Architecture provides a scalable, repeatable pattern for extracting heavy dependencies to dedicated workers. By establishing clear communication patterns, comprehensive error handling, and performance monitoring, this architecture enables:

1. **Significant performance improvements** through bundle size reduction
2. **Increased team autonomy** with independent deployment capabilities
3. **Improved system reliability** through failure isolation
4. **Scalable foundation** for future domain extractions

This implementation serves as the standard pattern for future micro-frontend architecture in the insurance application, establishing best practices and reusable components for domain isolation.
