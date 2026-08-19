-- Broker/system notes per CAR policy.
SELECT
  n.PolicyNoteId AS policyNoteId,
  n.PolicyId AS policyId,
  n.PolicyNoteTypeId AS policyNoteTypeId,
  n.NoteDescription AS noteDescription,
  n.DateCreated AS createdWhen,
  n.ChangedBy AS createdBy
FROM dbo.PolicyNote n
INNER JOIN dbo.Policy p ON p.PolicyId = n.PolicyId
WHERE p.ClassCode = 'CAR'
ORDER BY n.PolicyId, n.DateCreated, n.PolicyNoteId;
