-- Target migration: documents for in-scope CAR policies only (see _target-scope.sql).
SELECT
  pd.PolicyDocumentId AS policyDocumentId,
  pd.PolicyId AS policyId,
  p.PolicyNumber AS policyNumber,
  pd.Type AS documentTypeCode,
  pd.DocumentName AS documentName,
  pd.DocumentName AS filename,
  COALESCE(pd.ArchivedDate, pd.OrganiseITDate) AS generatedWhen
FROM dbo.PolicyDocument pd
INNER JOIN dbo.Policy p ON p.PolicyId = pd.PolicyId
INNER JOIN dbo.PolicyCAR pc ON pc.PolicyId = p.PolicyId
WHERE p.ClassCode = 'CAR'
  AND pc.Status IN (1, 2)
  AND pd.DocumentName NOT LIKE 'ERROR%'
ORDER BY pd.PolicyDocumentId;
