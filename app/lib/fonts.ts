import geistLatinExt from "@fontsource-variable/geist/files/geist-latin-ext-wght-normal.woff2?url";
import geistLatin from "@fontsource-variable/geist/files/geist-latin-wght-normal.woff2?url";

/** Same hashed URLs used for preload + @font-face so the font is cached before paint. */
export const geistFontFaces = [
  {
    href: geistLatin,
    unicodeRange:
      "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  },
  {
    href: geistLatinExt,
    unicodeRange:
      "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
  },
] as const;

/** Inline @font-face so first paint uses Geist (block + matching preload). */
export function geistFontFaceCss() {
  return geistFontFaces
    .map(
      ({ href, unicodeRange }) => `@font-face {
  font-family: "Geist Variable";
  font-style: normal;
  font-display: block;
  font-weight: 100 900;
  src: url("${href}") format("woff2-variations");
  unicode-range: ${unicodeRange};
}`,
    )
    .join("\n");
}

/** Apply saved/system theme before paint to avoid light→dark text reflow. */
export const themeInitScript = `(function(){try{var t=localStorage.getItem("theme");var d=t==="dark"||((t==null||t==="system")&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d)document.documentElement.classList.add("dark");}catch(e){}})();`;
