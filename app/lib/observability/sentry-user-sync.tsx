import { useEffect } from "react";

/** Sync authenticated user to Sentry on the client (id + email only). */
export function SentryUserSync({
  userId,
  email,
}: {
  userId: string;
  email: string;
}) {
  useEffect(() => {
    if (!import.meta.env.VITE_SENTRY_DSN?.trim()) return;
    void import("@sentry/react-router/cloudflare")
      .then((Sentry) => {
        Sentry.setUser({ id: userId, email });
      })
      .catch(() => {});
    return () => {
      void import("@sentry/react-router/cloudflare")
        .then((Sentry) => {
          Sentry.setUser(null);
        })
        .catch(() => {});
    };
  }, [userId, email]);

  return null;
}
