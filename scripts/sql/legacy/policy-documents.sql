-- Default: all policy documents for CAR policies.
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
WHERE p.ClassCode = 'CAR'
  AND pd.DocumentName NOT LIKE 'ERROR%'
ORDER BY pd.PolicyDocumentId;
