export const CLIENT_NOT_FOUND_HEADING = "Client does not exist";
export const CLIENT_NOT_FOUND_DETAILS =
  "This client may have been removed or the link is incorrect.";

export const POLICY_NOT_FOUND_HEADING = "Policy does not exist";
export const POLICY_NOT_FOUND_DETAILS =
  "This policy may have been removed or the link is incorrect.";

const RESOURCE_NOT_FOUND_DETAILS: Record<string, string> = {
  [CLIENT_NOT_FOUND_HEADING]: CLIENT_NOT_FOUND_DETAILS,
  [POLICY_NOT_FOUND_HEADING]: POLICY_NOT_FOUND_DETAILS,
};

export function getResourceNotFoundCopy(
  message: string,
): { subheading: string; details: string } | null {
  const details = RESOURCE_NOT_FOUND_DETAILS[message];
  if (!details) return null;
  return { subheading: message, details };
}

export function clientNotFoundResponse(): Response {
  return new Response(CLIENT_NOT_FOUND_HEADING, { status: 404 });
}

export function policyNotFoundResponse(): Response {
  return new Response(POLICY_NOT_FOUND_HEADING, { status: 404 });
}
