"use client";

import * as React from "react";

import { type Theme, ThemeContext } from "./context";

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: Theme;
  enableSystem?: boolean;
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  enableSystem = true,
}: ThemeProviderProps) {
  // Initialize theme state - on server, use defaultTheme
  // On client, check localStorage after hydration
  const [theme, setThemeState] = React.useState<Theme>(defaultTheme);

  // Initialize from localStorage on client only
  React.useEffect(() => {
    let mounted = true;

    const initializeTheme = () => {
      try {
        const stored = localStorage.getItem("theme") as Theme | null;
        if (mounted) {
          if (stored === "light" || stored === "dark") {
            setThemeState(stored);
          } else if (stored === "system" && enableSystem) {
            setThemeState("system");
          }
        }
      } catch {
        // Ignore errors
      }
    };

    // Use requestAnimationFrame to avoid synchronous updates during render
    requestAnimationFrame(initializeTheme);

    return () => {
      mounted = false;
    };
  }, [enableSystem]);

  const setTheme = React.useCallback((newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("theme", newTheme);
    } catch {
      // Ignore localStorage errors
    }
  }, []);

  // Apply theme to document
  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const root = window.document.documentElement;

    // Determine current theme class
    const currentTheme = root.classList.contains("dark") ? "dark" : "light";
    
    // Determine target theme class
    let targetTheme: "light" | "dark";
    if (theme === "system" && enableSystem) {
      targetTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } else if (theme === "light" || theme === "dark") {
      targetTheme = theme;
    } else {
      return; // No theme to apply
    }

    // Only update if theme changed
    if (currentTheme !== targetTheme) {
      root.classList.remove("light", "dark");
      root.classList.add(targetTheme);
    }
  }, [theme, enableSystem]);

  // Listen for system theme changes
  React.useEffect(() => {
    if (!enableSystem || theme !== "system") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

    const handleChange = () => {
      const root = window.document.documentElement;
      const currentTheme = root.classList.contains("dark") ? "dark" : "light";
      const systemTheme = mediaQuery.matches ? "dark" : "light";
      
      // Only update if theme changed
      if (currentTheme !== systemTheme) {
        root.classList.remove("light", "dark");
        root.classList.add(systemTheme);
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [enableSystem, theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
