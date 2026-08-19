#!/bin/bash

# Create Worker Domain Script
# Usage: ./tools/create-worker-domain.sh <domain-name>

set -e

# Check if domain name is provided
if [ $# -eq 0 ]; then
    echo "Usage: $0 <domain-name>"
    echo "Example: $0 documents"
    exit 1
fi

DOMAIN_NAME="$1"
TEMPLATE_DIR="workers/_template"
WORKER_DIR="workers/$DOMAIN_NAME"

echo "=== Creating new worker domain: $DOMAIN_NAME ==="

# Check if template directory exists
if [ ! -d "$TEMPLATE_DIR" ]; then
    echo "Error: Template directory $TEMPLATE_DIR not found."
    exit 1
fi

# Check if worker directory already exists
if [ -d "$WORKER_DIR" ]; then
    echo "Error: Worker directory $WORKER_DIR already exists."
    exit 1
fi

echo "1. Creating directory structure..."
mkdir -p "$WORKER_DIR"
cp -r "$TEMPLATE_DIR"/. "$WORKER_DIR"/

echo "2. Updating domain references..."
find "$WORKER_DIR" -type f \( -name "*.jsonc" -o -name "*.ts" -o -name "*.json" -o -name "*.md" \) -exec sed -i '' "s/_template/$DOMAIN_NAME/g" {} \;

# Special handling for wrangler config
if [ -f "$WORKER_DIR/wrangler._template.jsonc" ]; then
    mv "$WORKER_DIR/wrangler._template.jsonc" "$WORKER_DIR/wrangler.$DOMAIN_NAME.jsonc"
fi

echo "3. Updating file names..."
# Find and update files with template in name
find "$WORKER_DIR" -name "*_template*" | while read -r file; do
    new_file=$(echo "$file" | sed "s/_template/$DOMAIN_NAME/g")
    mv "$file" "$new_file"
done

echo "4. Initializing dependencies..."
cd "$WORKER_DIR"

# Check if we should install base dependencies
read -p "Install base dependencies? (y/n): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Installing base dependencies..."
    npm install
fi

echo "5. Domain configuration..."
cat > "README.$DOMAIN_NAME.md" << EOF
# $DOMAIN_NAME Worker Domain

## Domain Purpose
INSERT_DOMAIN_PURPOSE_HERE

## Key Components
1. MainComponent: [Purpose]
2. SecondaryComponent: [Purpose]

## Dependencies
- Domain-specific: [List heavy dependencies]
- Shared: React, React DOM

## Configuration
- Development port: [PORT_NUMBER]
- Production URL: [URL]
- Environment variables: [VARS]

## Integration Points
1. Portal integration via Module Federation
2. Cross-domain state sync
3. API endpoints

## Development Commands
\`\`\`bash
cd workers/$DOMAIN_NAME
npm run dev           # Development server
npm run build        # Production build
npm run deploy       # Deploy to Cloudflare
\`\`\`
EOF

echo "6. Updating main package.json scripts..."
cd ../..
if [ -f "package.json" ]; then
    # Add script to start this domain
    jq --arg domain "$DOMAIN_NAME" '.scripts["dev:' + $domain + '"] = "cd workers/'$DOMAIN_NAME' && npm run dev"' package.json > temp.json && mv temp.json package.json
fi

echo ""
echo "=== Worker Domain Created Successfully ==="
echo ""
echo "Next Steps:"
echo "1. Review and update: $WORKER_DIR/README.$DOMAIN_NAME.md"
echo "2. Add domain-specific dependencies: cd workers/$DOMAIN_NAME && npm install <package>"
echo "3. Update exports in: workers/$DOMAIN_NAME/src/exports/"
echo "4. Test development setup: npm run dev:$DOMAIN_NAME"
echo "5. Integrate with Portal: Update vite.config.federation.ts"
echo ""
echo "Quick Start:"
echo "  cd workers/$DOMAIN_NAME"
echo "  npm run dev"
echo ""
echo "Integration Example:"
echo "  // In Portal app"
echo "  import { lazy } from 'react';"
echo "  const ${DOMAIN_NAME^}Component = lazy(() => import('$DOMAIN_NAME/MainComponent'));"