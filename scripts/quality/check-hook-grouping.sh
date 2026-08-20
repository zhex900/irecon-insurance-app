#!/bin/bash

# Hook File Organization Monitor
# Checks for hook files that should be grouped (2+ files with same prefix)
# Run this script during code reviews or as a git pre-commit hook

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🔍 Hook File Organization Monitor"
echo "=================================="

HOOKS_DIR="app/hooks"
FOUND_ISSUES=0

# Function to extract prefix from hook filename
extract_prefix() {
  local filename="$1"
  # Remove 'use-' prefix and .ts extension
  local without_prefix="${filename#use-}"
  without_prefix="${without_prefix%.ts}"
  
  # Try to find common prefix with existing files
  # Extract first two words as initial guess
  local prefix_guess=$(echo "$without_prefix" | awk -F'-' '{print $1 "-" $2}')
  
  # Check if this prefix matches common patterns
  # For common patterns like "document-template-editor", try first three words
  if [[ $without_prefix =~ ^([a-z]+-[a-z]+-[a-z]+) ]]; then
    # If filename has at least 3 hyphen-separated parts, try that
    prefix_guess="${BASH_REMATCH[1]}"
  fi
  
  echo "$prefix_guess"
}

# Function to check directory for grouping opportunities
check_hooks_directory() {
  local dir="$1"
  echo -e "\nChecking ${dir}..."
  
  # Get all hook files in directory (excluding directories)
  local files
  if [ -d "$dir" ]; then
    files=$(find "$dir" -maxdepth 1 -name "*.ts" -type f | grep -E "use-" | sort)
  else
    echo "Directory $dir does not exist."
    return
  fi
  
  if [ -z "$files" ]; then
    echo "No hook files found."
    return
  fi
  
  # Create temporary files for analysis
  TMP_PREFIXES=$(mktemp)
  TMP_FILES=$(mktemp)
  
  # Process each file to extract prefixes
  for file in $files; do
    filename=$(basename "$file")
    prefix=$(extract_prefix "$filename")
    
    if [ -n "$prefix" ]; then
      echo "$prefix:$filename" >> "$TMP_PREFIXES"
    fi
  done
  
  # Find prefixes with 2+ files
  for prefix in $(cut -d':' -f1 "$TMP_PREFIXES" | sort | uniq); do
    count=$(grep -c "^$prefix:" "$TMP_PREFIXES" || true)
    
    if [ "$count" -ge 2 ]; then
      # Get files for this prefix
      files_list=$(grep "^$prefix:" "$TMP_PREFIXES" | cut -d':' -f2 | tr '\n' ', ' | sed 's/, $//')
      
      # Check if already grouped (directory exists)
      prefix_dir="${dir}/${prefix}"
      if [ -d "$prefix_dir" ]; then
        echo -e "${GREEN}✓${NC} Prefix '$prefix' already grouped ($(printf '%2s' $count) files)"
      else
        echo -e "${YELLOW}⚠${NC} Prefix '$prefix' has $(printf '%2s' $count) files but not grouped:"
        echo "  Files: $files_list"
        echo "  Suggested directory: $prefix_dir"
        echo "  Refactoring commands:"
        echo "    mkdir -p $prefix_dir"
        
        # Show move commands for each file
        grep "^$prefix:" "$TMP_PREFIXES" | while IFS=: read -r p filename; do
          # Remove prefix from filename to get new name
          new_name="use-${filename#use-$prefix-}"
          echo "    mv $dir/$filename $prefix_dir/$new_name"
        done
        
        echo "    # Create $prefix_dir/index.ts"
        echo "    # Update imports in consuming files"
        FOUND_ISSUES=$((FOUND_ISSUES + 1))
      fi
    fi
  done
  
  # Clean up temp files
  rm -f "$TMP_PREFIXES" "$TMP_FILES"
  
  # Also check for existing grouped directories to ensure they follow pattern
  if [ -d "$dir" ]; then
    for group_dir in "$dir"/*/; do
      if [ -d "$group_dir" ]; then
        group_name=$(basename "$group_dir")
        # Check if directory contains hook files
        hook_count=$(find "$group_dir" -name "*.ts" -type f | wc -l)
        
        if [ "$hook_count" -gt 0 ]; then
          # Check if directory has index.ts
          if [ -f "${group_dir}/index.ts" ]; then
            echo -e "${GREEN}✓${NC} Group '$group_name' properly organized ($hook_count files)"
          else
            echo -e "${YELLOW}⚠${NC} Group '$group_name' missing index.ts file"
            FOUND_ISSUES=$((FOUND_ISSUES + 1))
          fi
        fi
      fi
    done
  fi
}

# Main execution
check_hooks_directory "$HOOKS_DIR"

# Check for any components hooks directories as well
echo -e "\n🔎 Checking component-specific hooks directories..."
COMPONENT_HOOK_DIRS=$(find "app/components" -type d -name "hooks" | head -5)

for dir in $COMPONENT_HOOK_DIRS; do
  check_hooks_directory "$dir"
done

# Summary
echo -e "\n📊 Summary"
echo "=========="
if [ $FOUND_ISSUES -eq 0 ]; then
  echo -e "${GREEN}✅ All hook files properly organized${NC}"
else
  echo -e "${YELLOW}⚠ Found $FOUND_ISSUES organization issue(s)${NC}"
  echo ""
  echo "Suggested actions:"
  echo "1. Review the files listed above"
  echo "2. Group related hooks into directories (2+ files with same prefix)"
  echo "3. Create index.ts files for clean exports"
  echo "4. Update imports in consuming files"
  echo ""
  echo "See docs/guidelines/file-organization-standards.md for detailed guidelines."
  exit 1
fi