-- R2-only policy documents: remove inline PDF blobs and merge snapshots from Postgres.
-- PDF bytes live in R2 (policy_document.r2_key); metadata stays in Postgres.

UPDATE policy_document
SET content = CASE
  WHEN template_key IS NOT NULL THEN ''
  ELSE LEFT(content, 2000)
END
WHERE pdf_base64 IS NOT NULL
   OR merge_inputs IS NOT NULL
   OR (template_key IS NOT NULL AND content <> '');

ALTER TABLE policy_document DROP COLUMN IF EXISTS pdf_base64;
ALTER TABLE policy_document DROP COLUMN IF EXISTS merge_inputs;
