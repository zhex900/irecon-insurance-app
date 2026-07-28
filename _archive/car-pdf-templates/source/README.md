# CAR PDF / Word seed templates

Legacy Word mail-merge (`.doc`) and static library PDFs used to seed the app’s **pdfme** templates.

## Convert for the app

From `web/` (requires **Docker** for LibreOffice):

```bash
npm run pdf:templates
```

This converts each preferred `.doc` → PDF (style preserved), redacts `«MergeField»` placeholders, and writes pdfme templates to `app/assets/pdf-templates/`.

Reuse existing converted PDFs without re-running LibreOffice:

```bash
SKIP_LIBREOFFICE=1 npm run pdf:templates
```

## Preferred sources (latest)

| Slot | Source file |
| --- | --- |
| Schedule Annual | `CAR_iAnyware Schedule (Annual) [from 01.26].doc` |
| Schedule Single | `CAR_iAnyware Schedule (Single) [from 01.26].doc` |
| Schedule Owner Builder | `CAR_iAnyware Schedule (Owner Builder) [from 06.25] - v2.doc` |
| ROA Annual | `CAR_Quotation & Record of Answers (Annual) [from 01.26].doc` |
| ROA Single | `CAR_Quotation & Record of Answers (Single) [from 01.26].doc` |
| ROA Owner Builder | `CAR_Quotation & Record of Answers (Owner Builder) [from 06.25] - v2.doc` |
| Adjustment | `CAR_Adjustment.doc` |
