import * as React from "react";

const SCRIPT_BASE = "https://challenges.cloudflare.com/turnstile/v0/api.js";

type TurnstileRenderOptions = {
  sitekey: string;
  action?: string;
  size?: "normal" | "flexible" | "compact";
  callback?: (token: string) => void;
  "error-callback"?: () => void;
  "expired-callback"?: () => void;
};

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: TurnstileRenderOptions,
      ) => string;
      remove: (widgetId: string) => void;
    };
  }
}

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) return Promise.resolve();

  const existing = document.querySelector(`script[src^="${SCRIPT_BASE}"]`);
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener(
        "error",
        () => reject(new Error("Turnstile script failed to load")),
        { once: true },
      );
    });
  }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = `${SCRIPT_BASE}?render=explicit`;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Turnstile script failed to load"));
    document.head.appendChild(script);
  });
}

export function TurnstileWidget({
  siteKey,
  onTokenChange,
}: {
  siteKey: string;
  onTokenChange: (token: string | null) => void;
}) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const widgetIdRef = React.useRef<string | null>(null);
  const onTokenChangeRef = React.useRef(onTokenChange);

  React.useEffect(() => {
    onTokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  React.useEffect(() => {
    let cancelled = false;
    const container = containerRef.current;
    if (!container) return;

    loadTurnstileScript()
      .then(() => {
        if (cancelled || !window.turnstile || !containerRef.current) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: siteKey,
          action: "login",
          size: "flexible",
          callback: (token) => onTokenChangeRef.current(token),
          "error-callback": () => onTokenChangeRef.current(null),
          "expired-callback": () => onTokenChangeRef.current(null),
        });
      })
      .catch(() => onTokenChangeRef.current(null));

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
      onTokenChangeRef.current(null);
    };
  }, [siteKey]);

  return (
    <div
      ref={containerRef}
      data-turnstile-widget=""
      className="min-h-[65px] w-full"
    />
  );
}
