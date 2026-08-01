import { escapeRegExp } from "~/lib/search/match";

/** Highlight case-insensitive (and digit) matches in yellow. */
export function HighlightText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  const q = query.trim();
  if (!text) return null;
  if (!q) return <>{text}</>;

  const digits = q.replace(/\D/g, "");
  // Prefer text match; for pure digit queries also match digit runs in display values.
  let pattern = escapeRegExp(q);
  if (digits.length >= 2 && digits === q.replace(/\s/g, "")) {
    pattern = digits.split("").map(escapeRegExp).join("[\\s-]*");
  }

  let parts: string[] | null;
  let matchRe: RegExp | null;
  try {
    const splitRe = new RegExp(`(${pattern})`, "gi");
    matchRe = new RegExp(`^${pattern}$`, "i");
    parts = text.split(splitRe);
  } catch {
    parts = null;
    matchRe = null;
  }

  if (!parts || parts.length <= 1 || !matchRe) return <>{text}</>;
  const finalMatchRe = matchRe;

  return (
    <>
      {parts.map((part, index) => {
        if (!part) return null;
        if (finalMatchRe.test(part)) {
          return (
            <mark
              key={`${index}-${part}`}
              className="rounded-sm bg-warning/30 text-inherit"
              style={{ padding: 0, margin: 0 }}
            >
              {part}
            </mark>
          );
        }
        return <span key={`${index}-${part}`}>{part}</span>;
      })}
    </>
  );
}
