-- Default: all wholesale brokers (Authorised Representatives).
SELECT
  WholesaleBrokerId AS authorisedRepresentativeId,
  FullName AS fullName,
  PracticeName AS companyName,
  ARNumber AS arNumber,
  MobilePhone AS mobilePhone,
  BusinessPhone AS businessPhone,
  Email AS email,
  OwnBroker AS ownBroker
FROM dbo.WholesaleBroker
ORDER BY WholesaleBrokerId;
