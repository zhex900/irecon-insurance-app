-- R2-only policy documents: clear inline blobs before column drop (see 20260826130000).
-- PDF bytes live in R2 (policy_document.r2_key); metadata stays in Postgres.

UPDATE policy_document
SET content = CASE
  WHEN template_key IS NOT NULL THEN ''
  ELSE LEFT(content, 2000)
END
WHERE pdf_base64 IS NOT NULL
   OR merge_inputs IS NOT NULL
   OR (template_key IS NOT NULL AND content <> '');
