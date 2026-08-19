# Deployment Guide: Domain-Based Micro Frontends

## Overview

Deployment procedures, monitoring, and rollback strategies for domain-based micro frontends using Module Federation.

## Deployment Strategy

### Sequential Deployment Order

```bash
# 1. Deploy shared dependencies (if updated)
# 2. Deploy Documents domain (PDF heavy)
# 3. Deploy Admin domain (configuration)
# 4. Deploy Portal domain (shell)
# 5. Enable feature flags
```

### Environment-Specific Configurations

#### Development Environment

```yaml
development:
  portal_url: "http://localhost:5173"
  documents_url: "http://localhost:5174"
  admin_url: "http://localhost:5175"

  federation:
    enabled: true
    hot_reload: true
    debug_mode: true

  monitoring:
    console_logging: true
    performance_tracking: true
```

#### Staging Environment

```yaml
staging:
  portal_url: "https://portal-staging.example.com"
  documents_url: "https://documents-staging.example.com"
  admin_url: "https://admin-staging.example.com"

  federation:
    enabled: true
    feature_flags: true
    canary_deployment: false

  monitoring:
    sentry_enabled: true
    performance_dashboard: true
    error_tracking: true
```

#### Production Environment

```yaml
production:
  portal_url: "https://portal.example.com"
  documents_url: "https://documents.example.com"
  admin_url: "https://admin.example.com"

  federation:
    enabled: true
    feature_flags: false # All users see new version
    canary_deployment: true

  monitoring:
    full_monitoring: true
    alerting_enabled: true
    automated_rollback: true
```

## Deployment Commands

### Deploy Single Domain

```bash
# Deploy Documents domain to staging
cd workers/documents
npm run deploy:uat

# Deploy with specific version
npm run deploy:uat -- --tag v1.2.0

# Deploy to production (canary)
npm run deploy:production -- --canary 10  # 10% of users
```

### Deploy All Domains

```bash
# Automated deployment script
./infra/deploy-microfrontends.sh --env staging

# With validation
./infra/deploy-microfrontends.sh \
  --env production \
  --validate \
  --health-check \
  --notify-slack
```

### Canary Deployment

```bash
# Gradual rollout script
./scripts/deploy-canary.sh \
  --domain documents \
  --version v1.2.0 \
  --percentage 10 \
  --increase-daily 10 \
  --max-percentage 100 \
  --monitor-metrics \
  --auto-rollback-on-error
```

## Monitoring & Observability

### Health Checks

```bash
# Check Portal domain health
curl -s https://portal.example.com/health/federation

# Check Documents domain health
curl -s https://documents.example.com/health

# Comprehensive health check
./scripts/health-check.sh --all-domains
```

### Performance Metrics Dashboard

```typescript
// Real-time metrics collection
const metrics = {
  module_load_times: {
    documents: 250, // ms
    admin: 180, // ms
    portal: 120, // ms
  },

  cross_domain_latency: {
    portal_to_documents: 45, // ms
    portal_to_admin: 38, // ms
    documents_to_admin: 52, // ms
  },

  error_rates: {
    documents: 0.003, // 0.3%
    admin: 0.002, // 0.2%
    portal: 0.001, // 0.1%
  },

  bundle_sizes: {
    portal: 420, // KB gzipped
    documents: 780, // KB gzipped
    admin: 320, // KB gzipped
  },
};
```

### Alerting Thresholds

```yaml
critical_alerts:
  # Performance alerts
  module_load_time_over_1000ms: true
  cross_domain_latency_over_500ms: true
  error_rate_over_5_percent: true

  # Operational alerts
  domain_unhealthy_for_5_minutes: true
  memory_usage_over_80_percent: true
  deployment_failed_3_times: true

warning_alerts:
  # Performance warnings
  module_load_time_over_500ms: true
  cross_domain_latency_over_200ms: true
  error_rate_over_1_percent: true

  # Trend warnings
  error_rate_increasing: true
  load_time_trending_up: true
  bundle_size_increasing: true
```

## Rollback Procedures

### Automatic Rollback Triggers

```typescript
const ROLLBACK_TRIGGERS = {
  // Performance triggers
  avgLoadTimeExceeds: 1000, // 1 second
  errorRateExceeds: 0.05, // 5%
  memoryUsageExceeds: 0.8, // 80%

  // User experience triggers
  userComplaintsPerHour: 5,
  supportTicketsIncrease: 10,
  criticalFlowBroken: true,

  // Operational triggers
  deploymentFailureCount: 3,
  healthCheckFailures: 5,
  teamCannotDebug: true,
};
```

### Rollback Commands

```bash
# Rollback single domain
./scripts/rollback-domain.sh \
  --domain documents \
  --reason "performance_degradation" \
  --target-version previous-stable \
  --notify-team \
  --create-incident-report

# Emergency rollback (all domains)
./scripts/rollback-all.sh \
  --reason "critical_business_flow_broken" \
  --target-timestamp "2026-08-13T10:00:00Z" \
  --skip-confirmation \
  --alert-pagerduty
```

### Rollback Verification

```bash
# Verify rollback successful
./scripts/verify-rollback.sh \
  --domain documents \
  --expected-version v1.1.0 \
  --check-health \
  --check-performance \
  --check-user-flows

# Post-rollback actions
./scripts/post-rollback.sh \
  --analyze-failure-cause \
  --create-postmortem \
  --update-runbooks \
  --schedule-retrospective
```

## Version Compatibility Matrix

### Domain Version Compatibility

```yaml
compatibility_matrix:
  portal@1.x:
    documents: ">=1.0.0 <2.0.0"
    admin: ">=1.0.0 <2.0.0"

  portal@2.x:
    documents: ">=1.5.0 <3.0.0"
    admin: ">=1.5.0 <3.0.0"

  documents@1.x:
    portal: ">=1.0.0 <2.0.0"

  documents@2.x:
    portal: ">=1.5.0" # Breaking change requires Portal update
```

### Feature Flag Compatibility

```typescript
// Feature flags for gradual rollout
const FEATURE_FLAGS = {
  module_federation: {
    enabled: true,
    rollout_percentage: 100, // 100% of users
    user_groups: ["all"],
  },

  documents_v2: {
    enabled: false,
    rollout_percentage: 0, // 0% initially
    user_groups: ["beta-testers"],
    increase_daily_by: 10, // Increase 10% daily
  },

  admin_extraction: {
    enabled: false, // Not extracted yet
    rollout_percentage: 0,
    dependencies: ["documents_v2_stable"],
  },
};
```

## CI/CD Pipeline

### Build Pipeline

```yaml
# GitHub Actions / GitLab CI
stages:
  - build
  - test
  - deploy-staging
  - deploy-production

build:
  script:
    - npm ci
    - npm run build:federation
    - npm run bundle-analyze

test:
  script:
    - npm run test:unit
    - npm run test:integration
    - npm run test:performance

deploy-staging:
  script:
    - ./infra/deploy-microfrontends.sh --env staging
    - ./scripts/run-integration-tests.sh

deploy-production:
  script:
    - ./scripts/deploy-canary.sh --percentage 10
    - sleep 3600 # Wait 1 hour
    - ./scripts/check-metrics.sh
    - ./scripts/update-canary.sh --percentage 50
```

### Quality Gates

```yaml
quality_gates:
  code_coverage:
    minimum: 80%
    file: "**/*.{ts,tsx}"

  bundle_size:
    portal_max: 500KB
    documents_max: 800KB
    admin_max: 400KB

  performance:
    initial_load_max: 2000ms
    navigation_max: 500ms
    memory_usage_max: 128MB

  security:
    vulnerabilities_none: true
    dependency_audit_clean: true
    secrets_exposed_none: true
```

## Monitoring Dashboard Access

### Development Dashboard

```bash
# Local development
http://localhost:5173/_monitoring/federation

# Metrics endpoint
GET /api/federation-metrics
GET /api/domain-health
GET /api/performance-scores
```

### Production Dashboard

```bash
# Grafana / Datadog dashboards
# 1. Module Federation Performance
# 2. Cross-Domain Communication
# 3. Error Rates & Rollbacks
# 4. Bundle Size Trends

# Sentry projects
# - Portal Worker Errors
# - Documents Worker Errors
# - Admin Worker Errors
# - Cross-Domain Errors
```

## Team Operations

### On-Call Responsibilities

```yaml
primary_on_call:
  responsibilities:
    - Monitor deployment health
    - Respond to alerts
    - Execute rollbacks if needed
    - Communicate with team

  escalation_path:
    level1: Primary on-call engineer
    level2: Team lead
    level3: Head of engineering

  tools_access:
    - Deployment console
    - Monitoring dashboards
    - Rollback scripts
    - Incident management
```

### Post-Deployment Checklist

```bash
# 1. Verify deployment
./scripts/verify-deployment.sh --all-domains

# 2. Check performance
./scripts/check-performance.sh --compare-baseline

# 3. Monitor error rates
./scripts/monitor-errors.sh --duration 1h

# 4. Validate user flows
./scripts/test-user-flows.sh --critical-flows-only

# 5. Update documentation
./scripts/update-deployment-docs.sh --version $VERSION
```

## Troubleshooting Guide

### Common Issues & Solutions

#### Issue: Module Federation Fails to Load

```bash
# Symptoms: White screen, console errors about remoteEntry.js
# Solutions:
./scripts/diagnose-federation.sh

# 1. Check if Documents domain is running
curl https://documents.example.com/health

# 2. Check Module Federation configuration
cat workers/documents/vite.config.ts | grep federation

# 3. Clear browser cache
localStorage.clear()
sessionStorage.clear()

# 4. Use iframe fallback
# Add `fallbackType: "iframe"` to FederatedComponent
```

#### Issue: Cross-Domain State Sync Failing

```bash
# Symptoms: User sees stale data, permissions not updating
# Solutions:
./scripts/diagnose-state-sync.sh

# 1. Check event bus connectivity
GET /api/domain-events/health

# 2. Verify KV store connectivity
GET /api/kv-store/health

# 3. Check browser console for CORS errors
# 4. Implement manual sync button for users
```

#### Issue: Performance Degradation

```bash
# Symptoms: Slow navigation, high latency
# Solutions:
./scripts/diagnose-performance.sh

# 1. Check module load times
GET /api/module-load-times

# 2. Check cross-domain latency
GET /api/cross-domain-latency

# 3. Check bundle sizes
GET /api/bundle-sizes

# 4. Implement preloading optimizations
```

### Recovery Procedures

#### Immediate Recovery (Critical Issues)

```bash
# 1. Disable feature flags
./scripts/disable-feature-flags.sh --critical

# 2. Rollback to previous version
./scripts/rollback-domain.sh --skip-confirmation

# 3. Notify team and users
./scripts/notify-incident.sh --critical

# 4. Begin investigation
./scripts/begin-investigation.sh --priority-critical
```

#### Graceful Degradation (Performance Issues)

```bash
# 1. Reduce traffic to affected domain
./scripts/reduce-traffic.sh --domain documents --percentage 50

# 2. Enable iframe fallback
./scripts/enable-iframe-fallback.sh

# 3. Increase monitoring frequency
./scripts/increase-monitoring.sh --interval 10s

# 4. Begin performance optimization
./scripts/optimize-performance.sh --focus documents
```

## Best Practices

### Deployment Best Practices

1. **Always deploy to staging first** - Test thoroughly before production
2. **Use feature flags for new features** - Control rollout percentage
3. **Monitor key metrics during deployment** - Real-time performance tracking
4. **Have rollback procedures ready** - Test rollback before deployment
5. **Communicate changes to team** - Keep everyone informed

### Monitoring Best Practices

1. **Set up alerts before issues affect users** - Proactive monitoring
2. **Create dashboards for key metrics** - Single pane of glass
3. **Regularly review performance trends** - Catch issues early
4. **Automate incident response** - Faster recovery times
5. **Document troubleshooting procedures** - Team knowledge sharing

### Security Best Practices

1. **Validate cross-domain messages** - Only accept from trusted origins
2. **Implement proper CORS policies** - Restrict cross-origin requests
3. **Secure module loading** - Validate remoteEntry.js integrity
4. **Monitor for security issues** - Regular vulnerability scanning
5. **Keep dependencies updated** - Regular security patches

## Getting Started Checklist

### Pre-Deployment Checklist

```yaml
- [ ] All domains built successfully
- [ ] Integration tests passing
- [ ] Performance tests within thresholds
- [ ] Security scans clean
- [ ] Documentation updated
- [ ] Team trained on new procedures
- [ ] Rollback procedures tested
- [ ] Monitoring dashboards ready
- [ ] On-call team notified
- [ ] Feature flags configured
```

### Post-Deployment Checklist

```yaml
- [ ] Domain health checks passing
- [ ] Performance metrics within thresholds
- [ ] Error rates acceptable (< 0.5%)
- [ ] User feedback positive
- [ ] Team productivity maintained
- [ ] Monitoring alerts configured
- [ ] Documentation updated
- [ ] Lessons learned documented
- [ ] Next improvements planned
```

This deployment guide provides comprehensive procedures for safely deploying and operating domain-based micro frontends with Module Federation.
