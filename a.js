const a =
  "http://localhost:5173/policies/819b4579-ddda-483e-9788-e9f37c0d3b22.data".match(
    /policies\/.*\.data$/,
  );

console.log(a, a !== null);
