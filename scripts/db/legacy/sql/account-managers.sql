-- Default: all legacy account managers.
-- Override: npm run db:migrate:legacy -- --sql account-managers path/to/custom.sql
SELECT
  Code AS code,
  Abbrev AS abbrev,
  FullName AS fullName,
  EmailAddress AS email,
  ARNumber AS arNumber,
  Mobile AS mobile
FROM dbo.AccountManager
ORDER BY Code;
