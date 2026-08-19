/**
 * Client theme helpers — cookie storage + DOM class on `<html>`.
 * Do not set `className` on `<html>` from React; it resets on every Layout
 * re-render during navigation and causes a light/dark flash.
 */

import { setThemeCookie, type Theme } from "~/lib/cookies";

export type { Theme };

export function resolveTheme(
  theme: Theme,
  enableSystem = true,
): "light" | "dark" {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  if (enableSystem && typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "light";
}

/** Sync the resolved theme to `<html>` (Tailwind `dark` variant). */
export function applyThemeToDocument(
  theme: Theme,
  options?: { disableTransitions?: boolean; enableSystem?: boolean },
) {
  if (typeof document === "undefined") return;

  const enableSystem = options?.enableSystem ?? true;
  const disableTransitions = options?.disableTransitions ?? false;
  const resolved = resolveTheme(theme, enableSystem);
  const root = document.documentElement;

  let transitionBlock: HTMLStyleElement | null = null;
  if (disableTransitions) {
    transitionBlock = document.createElement("style");
    transitionBlock.textContent =
      "*,*::before,*::after{transition:none!important}";
    document.head.appendChild(transitionBlock);
  }

  if (resolved === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }

  if (transitionBlock) {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        transitionBlock.remove();
      });
    });
  }
}

/** Persist preference and apply to the document. */
export function persistTheme(
  theme: Theme,
  options?: { disableTransitions?: boolean; enableSystem?: boolean },
) {
  setThemeCookie(theme);
  applyThemeToDocument(theme, options);
}

/**
 * Inline script — runs before paint so the first frame matches the saved theme.
 * Must stay in sync with {@link resolveTheme} (cookie + system preference).
 */
export const themeInitScript = `(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]*)/);var t=m?decodeURIComponent(m[1]):null;var d=t==="dark"||((t==null||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;
