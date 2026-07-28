import { useEffect, useRef } from "react";
import { useFetcher } from "react-router";

/**
 * Supabase recovery links sometimes land with tokens in the URL hash
 * (not sent to the server). Post them to /auth/confirm to set cookies.
 */
export function AuthHashSessionBridge({
  next = "/reset-password",
}: {
  next?: string;
}) {
  const fetcher = useFetcher();
  const handledRef = useRef(false);

  useEffect(() => {
    if (handledRef.current || typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (!hash) return;

    const params = new URLSearchParams(hash);
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");
    const type = params.get("type");

    if (!accessToken || !refreshToken) return;
    if (type && type !== "recovery" && type !== "magiclink") return;

    handledRef.current = true;
    const data = new FormData();
    data.set("access_token", accessToken);
    data.set("refresh_token", refreshToken);
    data.set("next", next);
    fetcher.submit(data, { method: "post", action: "/auth/confirm" });
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}`,
    );
  }, [fetcher, next]);

  if (fetcher.state === "submitting" || fetcher.state === "loading") {
    return (
      <p className="text-sm text-muted-foreground">Confirming reset link…</p>
    );
  }

  return null;
}
