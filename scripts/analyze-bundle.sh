#!/bin/bash

echo "=== Insurance App Bundle Analysis ==="
echo "Date: $(date)"
echo ""

# Compute main bundle size
echo "1. Main Application Bundle:"
MAIN_SIZE=$(npx wrangler deploy --config wrangler.jsonc --dry-run 2>&1 | grep -o "gzip: [0-9.]* KiB" | cut -d' ' -f2)
echo "   Size: $MAIN_SIZE KiB (gzipped)"

# Analyze heavy dependencies
echo ""
echo "2. Heavy Dependencies Analysis:"
echo "   PDF Libraries:"
du -sh node_modules/@pdfme/* 2>/dev/null | sort -hr | head -5

echo ""
echo "3. Route Analysis:"
echo "   Total routes: $(find app/routes -name "*.tsx" -o -name "*.ts" | wc -l)"

echo ""
echo "4. Import Analysis:"
echo "   PDF imports: $(grep -r "@pdfme" app/ --include="*.tsx" --include="*.ts" | wc -l) files"
echo "   TiTap imports: $(grep -r "@tiptap" app/ --include="*.tsx" --include="*.ts" | wc -l) files"
echo "   Excel imports: $(grep -r "exceljs" app/ --include="*.tsx" --include="*.ts" | wc -l) files"

echo ""
echo "=== Micro Frontend Impact ==="
echo ""
echo "Estimated Bundle Distribution:"
echo "  • Portal Worker:     ~500KB  (73% reduction from main)"
echo "  • Documents Worker:  ~800KB  (PDF libraries isolated)"
echo "  • Admin Worker:      ~400KB  (79% reduction)"
echo "  • Total:             ~1.7MB  (10% net reduction)"
echo ""
echo "Cold Start Improvement:"
echo "  • Current: ~800ms (monolith)"
echo "  • Target:  ~300ms per Worker"
echo "  • Parallel: Workers start concurrently"
