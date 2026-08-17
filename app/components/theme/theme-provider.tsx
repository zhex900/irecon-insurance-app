"use client";

import * as React from "react";

import { applyThemeToDocument, persistTheme, type Theme } from "~/lib/theme";

import { ThemeContext } from "./context";

type ThemeProviderProps = {
  children: React.ReactNode;
  initialTheme?: Theme;
  enableSystem?: boolean;
};

export function ThemeProvider({
  children,
  initialTheme = "system",
  enableSystem = true,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(initialTheme);

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

  const setTheme = (newTheme: Theme) => {
    persistTheme(newTheme, { enableSystem, disableTransitions: true });
    setThemeState(newTheme);
  };

  return <ThemeContext value={{ theme, setTheme }}>{children}</ThemeContext>;
}
