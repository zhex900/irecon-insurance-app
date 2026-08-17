import "./app.css";

import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
} from "react-router";

import { RootErrorBoundary } from "~/components/root-error-boundary";
import { ThemeProvider } from "~/components/theme/theme-provider";
import { getThemeClassForSSR, getThemeFromCookies } from "~/lib/cookies";
import { geistFontFaceCss, geistFontFaces } from "~/lib/fonts";

import type { Route } from "./+types/root";

export const links: Route.LinksFunction = () => [
  { rel: "icon", href: "/favicon.ico", sizes: "any" },
  { rel: "icon", href: "/favicon-32.png", type: "image/png", sizes: "32x32" },
  { rel: "icon", href: "/favicon-16.png", type: "image/png", sizes: "16x16" },
  { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
  ...geistFontFaces.map(({ href }) => ({
    rel: "preload" as const,
    href,
    as: "font" as const,
    type: "font/woff2",
    crossOrigin: "anonymous" as const,
  })),
];

export async function loader({ request }: Route.LoaderArgs) {
  const cookie = request.headers.get("Cookie");

  const theme = getThemeFromCookies(cookie);

  return {
    theme: theme ?? "system",
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const loaderData = useLoaderData<typeof loader>();
  const { theme } = loaderData;

  // Determine which theme class to apply for SSR
  const themeClass = getThemeClassForSSR(theme);

  return (
    <html lang="en" className={themeClass}>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <style
          dangerouslySetInnerHTML={{
            __html: geistFontFaceCss(),
          }}
        />
      </head>
      <body>
        <ThemeProvider initialTheme={theme} enableSystem>
          {children}
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  return <RootErrorBoundary error={error} />;
}
