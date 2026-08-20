#!/bin/bash
# Quick Hook Check - Run in IDE for instant feedback

echo "🔍 Quick Hook Check"
echo "=================="

# Check current directory or most likely hooks location
if [ -d "app/hooks" ]; then
  HOOKS_DIR="app/hooks"
elif [ -d "../app/hooks" ]; then
  HOOKS_DIR="../app/hooks"
else
  echo "Could not find hooks directory."
  exit 1
fi

echo "Checking: $HOOKS_DIR"

# Quick scan for obvious issues
ISSUES=0

# 1. Check for files with same prefix
echo -e "\n1. Checking for ungrouped prefixes..."
PREFIX_CHECK=$(find "$HOOKS_DIR" -maxdepth 1 -name "use-*.ts" -type f | \
  xargs -I {} basename {} | \
  sed 's/^use-//; s/\.ts$//' | \
  awk -F'-' '{print $1 "-" $2}' | \
  sort | uniq -c | sort -rn | \
  awk '$1 >= 2 {print $2 " (" $1 " files)"}')

if [ -n "$PREFIX_CHECK" ]; then
  echo "⚠ Found prefixes that should be grouped:"
  echo "$PREFIX_CHECK"
  ISSUES=$((ISSUES + 1))
else
  echo "✓ No obvious prefix grouping issues"
fi

# 2. Check grouped directories have index.ts
echo -e "\n2. Checking grouped directories..."
for dir in "$HOOKS_DIR"/*/; do
  if [ -d "$dir" ]; then
    dir_name=$(basename "$dir")
    if [ -f "$dir/index.ts" ]; then
      hook_count=$(find "$dir" -name "*.ts" -type f | wc -l)
      echo "✓ $dir_name ($hook_count files, has index.ts)"
    else
      echo "⚠ $dir_name missing index.ts file"
      ISSUES=$((ISSUES + 1))
    fi
  fi
done

# 3. Quick stats
TOTAL_HOOKS=$(find "$HOOKS_DIR" -name "*.ts" -type f | wc -l)
GROUPED_HOOKS=$(find "$HOOKS_DIR" -mindepth 2 -name "*.ts" -type f | wc -l)
PERCENT_GROUPED=$((GROUPED_HOOKS * 100 / TOTAL_HOOKS))

echo -e "\n3. Statistics:"
echo "   Total hooks: $TOTAL_HOOKS"
echo "   Grouped hooks: $GROUPED_HOOKS ($PERCENT_GROUPED%)"
echo "   Ungrouped hooks: $((TOTAL_HOOKS - GROUPED_HOOKS))"

# Summary
echo -e "\n📊 Summary"
echo "=========="
if [ $ISSUES -eq 0 ]; then
  echo "✅ All good! Hook organization looks proper."
else
  echo "⚠ Found $ISSUES organization issue(s)"
  echo ""
  echo "Run the full check for details:"
  echo "  ./scripts/quality/check-hook-grouping.sh"
fi