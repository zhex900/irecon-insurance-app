import type { AppUser, BrokerSession } from "~/lib/db/types";

export function toBrokerSession(user: AppUser): BrokerSession {
  return {
    id: user.userId,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    authorisedRepresentativeId: user.authorisedRepresentativeId ?? 0,
    avatarR2Key: user.avatarR2Key,
  };
}
