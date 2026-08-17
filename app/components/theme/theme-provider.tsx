"use client";

import * as React from "react";

import {
  applyThemeToDocument,
  persistTheme,
  readStoredTheme,
  type Theme,
} from "~/lib/theme";

import { ThemeContext } from "./context";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  enableSystem?: boolean;
}

const themeListeners = new Set<() => void>();

function subscribeTheme(listener: () => void) {
  themeListeners.add(listener);
  return () => themeListeners.delete(listener);
}

function notifyThemeListeners() {
  for (const listener of themeListeners) {
    listener();
  }
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
}: ThemeProviderProps) {
  const theme = React.useSyncExternalStore(
    subscribeTheme,
    () => readStoredTheme(defaultTheme),
    () => defaultTheme,
  );

  React.useEffect(() => {
    applyThemeToDocument(theme, { enableSystem });
  }, [theme, enableSystem]);

  React.useEffect(() => {
    if (!enableSystem || theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      applyThemeToDocument("system", {
        enableSystem: true,
        disableTransitions: true,
      });
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, enableSystem]);

  const setTheme = React.useCallback(
    (newTheme: Theme) => {
      persistTheme(newTheme, { enableSystem, disableTransitions: true });
      notifyThemeListeners();
    },
    [enableSystem],
  );

  return (
    <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>
  );
}
