#!/bin/bash

# Micro Frontend Deployment Script
# Deploys all Workers in correct order

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Insurance App Micro Frontend Deployment ===${NC}"
echo "Date: $(date)"
echo ""

# Function to deploy a Worker
deploy_worker() {
  local worker_name=$1
  local config_path=$2
  local env=${3:-uat}
  
  echo -e "${BLUE}Deploying ${worker_name} to ${env}...${NC}"
  
  if [ ! -f "$config_path" ]; then
    echo -e "${RED}Config file not found: ${config_path}${NC}"
    return 1
  fi
  
  # Run dry-run first to check bundle size
  echo -e "Checking bundle size..."
  local bundle_info=$(npx wrangler deploy --config "$config_path" --dry-run 2>&1 | grep -E "(gzip:|Total)" | tail -2)
  echo -e "Bundle info:\n$bundle_info"
  
  # Confirm deployment
  read -p "Continue with deployment? (y/n): " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Skipping ${worker_name}${NC}"
    return 0
  fi
  
  # Deploy
  echo -e "Deploying..."
  if npx wrangler deploy --config "$config_path" --env "$env"; then
    echo -e "${GREEN}✓ ${worker_name} deployed successfully${NC}"
  else
    echo -e "${RED}✗ ${worker_name} deployment failed${NC}"
    return 1
  fi
  
  echo ""
}

# Function to check Worker health
check_worker_health() {
  local worker_url=$1
  
  echo -e "Checking health of ${worker_url}..."
  
  local max_attempts=10
  local attempt=1
  local health_ok=false
  
  while [[ $attempt -le $max_attempts && $health_ok == false ]]; do
    echo -e "Attempt $attempt/$max_attempts..."
    
    if curl -s -f --retry 2 --retry-delay 1 -o /dev/null "$worker_url/health"; then
      echo -e "${GREEN}✓ ${worker_url} is healthy${NC}"
      health_ok=true
    else
      echo -e "${RED}✗ ${worker_url} health check failed${NC}"
      sleep 2
    fi
    
    attempt=$((attempt + 1))
  done
  
  if [[ $health_ok == false ]]; then
    echo -e "${RED}✗ ${worker_url} failed health check after $max_attempts attempts${NC}"
    return 1
  fi
  
  return 0
}

# Main deployment sequence
main() {
  local env=${1:-uat}
  
  echo -e "${BLUE}Deploying to environment: ${env}${NC}"
  echo ""
  
  # Step 1: Deploy shared infrastructure Workers first
  echo -e "${BLUE}=== Step 1: Deploying Shared Infrastructure ===${NC}"
  
  # Deploy Document UI Worker
  deploy_worker "Document UI Worker" "workers/documents-ui/wrangler.documents-ui.jsonc" "$env"
  
  # Deploy Admin UI Worker (if exists)
  if [ -f "workers/admin-ui/wrangler.admin.jsonc" ]; then
    deploy_worker "Admin UI Worker" "workers/admin-ui/wrangler.admin.jsonc" "$env"
  else
    echo -e "${BLUE}Admin UI Worker not configured yet${NC}"
  fi
  
  # Step 2: Deploy main Worker with service bindings
  echo -e "${BLUE}=== Step 2: Deploying Main Portal Worker ===${NC}"
  
  if [ "$env" == "production" ]; then
    deploy_worker "Portal Worker" "wrangler.jsonc" "$env"
  else
    deploy_worker "Portal Worker" "wrangler.expanded.jsonc" "$env"
  fi
  
  # Step 3: Verify deployments
  echo -e "${BLUE}=== Step 3: Verifying Deployments ===${NC}"
  
  # Get Worker URLs from config or environment
  DOCUMENTS_UI_URL=$(node -e "console.log(require('./wrangler.expanded.jsonc').vars?.DOCUMENTS_UI_URL || 'https://documents-ui.example.com')")
  MAIN_WORKER_URL=$(node -e "console.log(require('./wrangler.expanded.jsonc').vars?.APP_URL || 'https://portal.example.com')")
  
  echo -e "Checking Worker health..."
  
  # Check Document UI Worker
  check_worker_health "$DOCUMENTS_UI_URL"
  
  # Check Main Worker
  check_worker_health "$MAIN_WORKER_URL"
  
  # Step 4: Test integration
  echo -e "${BLUE}=== Step 4: Testing Integration ===${NC}"
  
  echo -e "Testing cross-Worker authentication..."
  # Simple integration test
  local test_result=$(curl -s "$MAIN_WORKER_URL/health" 2>&1)
  if [[ "$test_result" == "OK" ]]; then
    echo -e "${GREEN}✓ Main Worker responding${NC}"
  else
    echo -e "${RED}✗ Main Worker test failed: $test_result${NC}"
  fi
  
  # Step 5: Bundle size comparison
  echo -e "${BLUE}=== Step 5: Bundle Size Analysis ===${NC}"
  
  echo -e "Running bundle analysis..."
  ./scripts/analyze-bundle.sh
  
  # Step 6: Next steps
  echo -e "${BLUE}=== Step 6: Deployment Complete ===${NC}"
  echo ""
  echo -e "Next steps:"
  echo -e "1. Monitor Worker health: ${MAIN_WORKER_URL}/health"
  echo -e "2. Test document designer: ${MAIN_WORKER_URL}/documents/designer"
  echo -e "3. Check Sentry for errors"
  echo -e "4. Monitor Cloudflare Worker metrics"
  echo ""
  echo -e "To rollback individual Workers:"
  echo -e "  wrangler rollback --config wrangler.documents-ui.jsonc"
  echo -e "  wrangler rollback --config wrangler.expanded.jsonc"
  echo ""
  echo -e "To update environment variables:"
  echo -e "  Edit wrangler.*.jsonc and re-deploy"
  
  echo -e "${GREEN}✓ Deployment completed${NC}"
}

# Run main function
main "$@"