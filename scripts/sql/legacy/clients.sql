-- Target migration: clients that own at least one in-scope CAR policy.
-- Scope: scripts/sql/legacy/_target-scope.sql
-- authorisedRepresentativeId is not on legacy Client; SubAgent.LeadBroker when set.
SELECT
  c.ClientId AS clientId,
  c.Name AS name,
  COALESCE(NULLIF(LTRIM(RTRIM(c.TradingName)), ''), c.Name) AS tradingName,
  COALESCE(c.ABN, '') AS abn,
  COALESCE(NULLIF(LTRIM(RTRIM(c.Phone)), ''), NULLIF(LTRIM(RTRIM(c.Mobile)), ''), '') AS phone,
  COALESCE(c.Email, '') AS email,
  COALESCE(c.AccountManagerCode, '.NA') AS accountManagerCode,
  COALESCE(c.ClientSourceID, 16) AS clientSourceId,
  CASE
    WHEN sa.LeadBroker IS NOT NULL AND sa.LeadBroker > 0 THEN sa.LeadBroker
    ELSE NULL
  END AS authorisedRepresentativeId,
  c.CreationDate AS createdWhen
FROM dbo.Client c
LEFT JOIN dbo.SubAgent sa ON sa.Code = c.SubAgentCode
WHERE c.ClientId IN (
  SELECT p.ClientId
  FROM dbo.Policy p
  INNER JOIN dbo.PolicyCAR pc ON pc.PolicyId = p.PolicyId
  WHERE p.ClassCode = 'CAR'
    AND p.InceptionDate >= '2025-06-01'
)
ORDER BY c.ClientId;
