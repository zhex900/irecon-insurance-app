-- R2-only policy documents: drop inline PDF blobs and merge snapshots from Postgres.
-- PDF bytes live in R2 (policy_document.r2_key); metadata stays in Postgres.

UPDATE policy_document
SET
  pdf_base64 = NULL,
  merge_inputs = NULL,
  content = CASE
    WHEN template_key IS NOT NULL THEN ''
    ELSE LEFT(content, 2000)
  END
WHERE pdf_base64 IS NOT NULL
   OR merge_inputs IS NOT NULL
   OR (template_key IS NOT NULL AND content <> '');

COMMENT ON COLUMN policy_document.pdf_base64 IS
  'Deprecated — do not write. PDF bytes are stored in R2 (r2_key).';

COMMENT ON COLUMN policy_document.merge_inputs IS
  'Deprecated — do not write. Regenerate PDFs from live policy + template.';
