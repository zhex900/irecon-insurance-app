-- Broker/system notes for in-scope CAR policies (see _target-scope.sql).
SELECT
  n.PolicyNoteId AS policyNoteId,
  n.PolicyId AS policyId,
  n.PolicyNoteTypeId AS policyNoteTypeId,
  n.NoteDescription AS noteDescription,
  n.DateCreated AS createdWhen,
  n.ChangedBy AS createdBy
FROM dbo.PolicyNote n
INNER JOIN dbo.Policy p ON p.PolicyId = n.PolicyId
INNER JOIN dbo.PolicyCAR pc ON pc.PolicyId = p.PolicyId
WHERE p.ClassCode = 'CAR'
  AND pc.Status IN (1, 2)
ORDER BY n.PolicyId, n.DateCreated, n.PolicyNoteId;
