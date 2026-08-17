/**
 * Cookie utilities for theme storage
 * Using cookies allows server-side reading of theme preference
 */

export type Theme = "light" | "dark" | "system";

const THEME_COOKIE_NAME = "theme";
const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Parse a cookie string into an object
 */
export function parseCookies(cookieString: string | null | undefined): Record<string, string> {
  if (!cookieString) return {};

  return cookieString.split(";").reduce((cookies, cookie) => {
    const [name, ...valueParts] = cookie.trim().split("=");
    const value = valueParts.join("="); // Handle cookies with = in value
    if (name && value !== undefined) {
      cookies[name] = decodeURIComponent(value);
    }
    return cookies;
  }, {} as Record<string, string>);
}

/**
 * Get theme from cookies (works on server and client)
 */
export function getThemeFromCookies(cookieString?: string | null): Theme | null {
  const cookies = parseCookies(cookieString ?? undefined);
  const theme = cookies[THEME_COOKIE_NAME];
  
  if (theme === "light" || theme === "dark" || theme === "system") {
    return theme;
  }
  
  return null;
}

/**
 * Set theme cookie (client-side only)
 */
export function setThemeCookie(theme: Theme): void {
  if (typeof document === "undefined") return;
  
  const cookieValue = `${THEME_COOKIE_NAME}=${encodeURIComponent(theme)}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; SameSite=Lax`;
  document.cookie = cookieValue;
}

/**
 * Create a cookie header string for setting theme from server
 */
export function createThemeCookieHeader(theme: Theme): string {
  return `${THEME_COOKIE_NAME}=${encodeURIComponent(theme)}; Path=/; Max-Age=${THEME_COOKIE_MAX_AGE}; HttpOnly; SameSite=Lax`;
}

/**
 * Remove theme cookie
 */
export function removeThemeCookie(): void {
  if (typeof document === "undefined") return;
  
  // Set max-age to 0 to expire immediately
  document.cookie = `${THEME_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`;
}

/**
 * Check if we're on the client side
 */
export function isClient(): boolean {
  return typeof window !== "undefined";
}

/**
 * Get theme with fallback logic (for server-side rendering)
 * When theme is "system", we default to light on server since we can't know
 * the user's system preference server-side.
 */
export function getThemeWithFallback(
  request?: Request,
  defaultTheme: Theme = "system"
): Theme {
  // Try to get from cookies first
  const cookieHeader = request?.headers.get("Cookie");
  const themeFromCookie = getThemeFromCookies(cookieHeader);
  
  if (themeFromCookie) {
    // If theme is "system", return it as is - client will handle system preference
    return themeFromCookie;
  }
  
  return defaultTheme;
}

/**
 * Get theme class for server-side rendering
 * Returns "dark" only if theme is explicitly "dark"
 * Returns empty string for "light", "system", or default
 */
export function getThemeClassForSSR(theme: Theme): string {
  return theme === "dark" ? "dark" : "";
}