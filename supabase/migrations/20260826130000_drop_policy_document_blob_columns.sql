-- R2-only policy documents: remove inline PDF blob columns.

ALTER TABLE policy_document DROP COLUMN IF EXISTS pdf_base64;
ALTER TABLE policy_document DROP COLUMN IF EXISTS merge_inputs;
