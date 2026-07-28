import type { AppUser, BrokerSession } from "~/lib/db/types";

export function toBrokerSession(user: AppUser): BrokerSession {
  return {
    id: user.userId,
    fullName: user.fullName,
    email: user.email,
    role: user.role,
    authorisedRepresentativeId: user.authorisedRepresentativeId ?? 1,
    avatarR2Key: user.avatarR2Key,
  };
}

/** @deprecated Prefer `toBrokerSession(await requireAuth(request))` in loaders. */
export function getBrokerSession(): BrokerSession {
  return {
    id: "broker-demo",
    fullName: "Demo Broker",
    email: "broker@demo.local",
    role: "broker",
    authorisedRepresentativeId: 1,
    avatarR2Key: null,
  };
}
