# CAR pdfme templates

Generated from `car-pdf-templates/*.doc` with **original Word style preserved**.

## How style is kept

1. Docker LibreOffice converts each `.doc` → PDF (`base-pdfs/*.pdf`)
2. Merge-field markers (`«FieldName»`) are located (including split runs)
3. Placeholders are white-redacted on the base PDF
4. pdfme text schemas overlay those positions for live values

## Regenerate

```bash
npm run pdf:templates
SKIP_LIBREOFFICE=1 npm run pdf:templates
```

Requires Docker (`linuxserver/libreoffice`).
