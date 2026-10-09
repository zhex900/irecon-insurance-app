-- Additional wording for in-scope CAR policies (see _target-scope.sql).
SELECT
  w.PolicyId AS policyId,
  w.CAR_WordingId AS carWordingId,
  w.Subject AS subject,
  w.Content AS content
FROM dbo.PolicyCARWording w
INNER JOIN dbo.Policy p ON p.PolicyId = w.PolicyId
INNER JOIN dbo.PolicyCAR pc ON pc.PolicyId = p.PolicyId
WHERE p.ClassCode = 'CAR'
  AND pc.Status IN (1, 2)
ORDER BY w.PolicyId, w.PolicyCARWordingID;
