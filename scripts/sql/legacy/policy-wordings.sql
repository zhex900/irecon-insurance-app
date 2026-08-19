-- Additional wording rows per CAR policy (catalogue + custom snapshots).
SELECT
  w.PolicyId AS policyId,
  w.CAR_WordingId AS carWordingId,
  w.Subject AS subject,
  w.Content AS content
FROM dbo.PolicyCARWording w
INNER JOIN dbo.Policy p ON p.PolicyId = w.PolicyId
WHERE p.ClassCode = 'CAR'
ORDER BY w.PolicyId, w.PolicyCARWordingID;
