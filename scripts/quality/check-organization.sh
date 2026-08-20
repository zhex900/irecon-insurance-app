#!/bin/bash

# Directory Organization Check Script
# This script checks for common directory and naming violations

echo "🔍 Running directory organization checks..."

ERRORS=0

# 1. Check for single-word component files (excluding ui/ directory)
echo "1. Checking for single-word component files..."
SINGLE_WORD_FILES=$(find app/components -name "*.tsx" -exec sh -c 'basename "$1" | grep -qE "^[a-z]+\.tsx$" && echo "$1"' _ {} \; | grep -v "/ui/" | grep -v "/reui/" | grep -v "index.tsx")

if [ -n "$SINGLE_WORD_FILES" ]; then
    echo "❌ Found single-word component files (should have min 2 words):"
    echo "$SINGLE_WORD_FILES" | head -10
    if [ $(echo "$SINGLE_WORD_FILES" | wc -l) -gt 10 ]; then
        echo "... and $(($(echo "$SINGLE_WORD_FILES" | wc -l) - 10)) more"
    fi
    ERRORS=$((ERRORS + 1))
else
    echo "✅ No single-word component files found"
fi

# 2. Check for files with 4+ words
echo -e "\n2. Checking for files with 4+ words..."
FOUR_PLUS_WORD_FILES=$(find app/components -name "*.tsx" -exec basename {} \; | grep -E "^([a-z]+-){3,}[a-z]+\.tsx$")

if [ -n "$FOUR_PLUS_WORD_FILES" ]; then
    echo "⚠️  Found files with 4+ words (max 3 recommended):"
    echo "$FOUR_PLUS_WORD_FILES" | head -10
    if [ $(echo "$FOUR_PLUS_WORD_FILES" | wc -l) -gt 10 ]; then
        echo "... and $(($(echo "$FOUR_PLUS_WORD_FILES" | wc -l) - 10)) more"
    fi
    # Not counting as error, just warning
else
    echo "✅ No files with 4+ words found"
fi

# 3. Check for domain redundancy in clients directory
echo -e "\n3. Checking for domain redundancy..."
CLIENT_REDUNDANT_FILES=$(find app/components/clients -name "client-*.tsx" -o -name "client-*.ts" | head -5)

if [ -n "$CLIENT_REDUNDANT_FILES" ]; then
    echo "❌ Found files with redundant 'client-' prefix in clients directory:"
    echo "$CLIENT_REDUNDANT_FILES"
    ERRORS=$((ERRORS + 1))
else
    echo "✅ No domain redundancy found in clients directory"
fi

# 4. Check hook organization (flat hooks that could be grouped)
echo -e "\n4. Checking hook organization..."
FLAT_HOOKS_COUNT=$(find app/hooks -maxdepth 1 -name "use-*.ts" | wc -l)

if [ "$FLAT_HOOKS_COUNT" -gt 5 ]; then
    echo "⚠️  Found $FLAT_HOOKS_COUNT flat hooks in app/hooks/ (consider grouping related hooks)"
    echo "   Examples: $(find app/hooks -maxdepth 1 -name "use-*.ts" | head -3 | xargs -I {} basename {} | tr '\n' ' ')"
else
    echo "✅ Hook organization looks good"
fi

# 5. Check ESLint
echo -e "\n5. Running ESLint check..."
if npx eslint . --max-warnings=0 > /dev/null 2>&1; then
    echo "✅ ESLint check passed"
else
    echo "❌ ESLint check failed"
    npx eslint . --max-warnings=0 2>&1 | head -20
    ERRORS=$((ERRORS + 1))
fi

# Summary
echo -e "\n📊 Summary:"
if [ "$ERRORS" -eq 0 ]; then
    echo "✅ All checks passed!"
    exit 0
else
    echo "❌ Found $ERRORS critical issue(s)"
    echo "   Run 'npm run lint' to see details"
    exit 1
fi