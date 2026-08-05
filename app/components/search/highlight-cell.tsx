import { HighlightText } from "~/components/search/highlight";
import { fieldMatches } from "~/lib/search/match";

/** Show text; when `query` is set, highlight matches (unchanged if no match). */
export function SearchHighlight({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!text) return null;
  if (!query) return <>{text}</>;
  return <HighlightText text={text} query={query} />;
}

/** Like SearchHighlight, but returns null when searching and the field does not match. */
export function MatchOnlyHighlight({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!text) return null;
  if (!query) return <>{text}</>;
  if (!fieldMatches(text, query)) return null;
  return <HighlightText text={text} query={query} />;
}
