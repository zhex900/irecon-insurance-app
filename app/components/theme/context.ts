import * as React from "react";

import type { Theme } from "~/lib/cookies";

export type { Theme };

export interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = React.createContext<ThemeContextType | null>(null);
