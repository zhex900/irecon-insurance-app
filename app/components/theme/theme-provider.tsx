"use client";

import * as React from "react";

import { setThemeCookie } from "~/lib/cookies";

import { type Theme, ThemeContext } from "./context";

interface ThemeProviderProps {
  children: React.ReactNode;
  initialTheme?: Theme;
  enableSystem?: boolean;
}

function resolveTheme(theme: Theme, enableSystem: boolean): "light" | "dark" {
  if (theme === "dark") {
    return "dark";
  }

  if (theme === "light") {
    return "light";
  }

  if (enableSystem) {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return "light";
}

function applyTheme(theme: Theme, enableSystem: boolean) {
  const resolvedTheme = resolveTheme(theme, enableSystem);

  document.documentElement.classList.remove("light", "dark");
  document.documentElement.classList.add(resolvedTheme);
}

export function ThemeProvider({
  children,
  initialTheme = "system",
  enableSystem = true,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(initialTheme);

  const setTheme = React.useCallback(
    (newTheme: Theme) => {
      setThemeState(newTheme);

      setThemeCookie(newTheme);

      applyTheme(newTheme, enableSystem);
    },
    [enableSystem],
  );

  React.useEffect(() => {
    if (!enableSystem || theme !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      applyTheme("system", true);
    };

    mediaQuery.addEventListener("change", handleChange);

    return () => {
      mediaQuery.removeEventListener("change", handleChange);
    };
  }, [theme, enableSystem]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
