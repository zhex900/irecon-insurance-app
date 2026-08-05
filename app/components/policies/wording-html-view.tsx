import { sanitizeWordingHtml } from "~/lib/policies/wording/html";
import { cn } from "~/lib/utils";

/** Safe read-only render of Additional Wording HTML. */
export function WordingHtmlView({
  html,
  className,
  clampLines,
}: {
  html: string;
  className?: string;
  /** Tailwind line-clamp (e.g. 2). */
  clampLines?: 2 | 3 | 4;
}) {
  const safe = sanitizeWordingHtml(html);
  if (!safe) return null;

  return (
    <div
      className={cn(
        "wording-html-view wording-list-styles text-sm leading-relaxed",
        clampLines === 2 && "line-clamp-2",
        clampLines === 3 && "line-clamp-3",
        clampLines === 4 && "line-clamp-4",
        className,
      )}
      dangerouslySetInnerHTML={{ __html: safe }}
    />
  );
}
