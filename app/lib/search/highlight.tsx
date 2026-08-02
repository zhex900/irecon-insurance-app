import { highlightSegments } from "~/lib/search/match";

/** Highlight case-insensitive (and digit) matches in yellow. */
export function HighlightText({
  text,
  query,
}: {
  text: string;
  query: string;
}) {
  if (!text) return null;
  const segments = highlightSegments(text, query);
  if (!segments) return <>{text}</>;

  return (
    <>
      {segments.map((segment, index) =>
        segment.match ? (
          // children= avoids JSX whitespace text nodes that insert spaces into phone/ABN digits
          <mark
            key={`${index}-${segment.text}`}
            className="m-0 rounded-sm bg-warning/30 p-0 text-inherit"
            children={segment.text}
          />
        ) : (
          <span key={`${index}-${segment.text}`} children={segment.text} />
        ),
      )}
    </>
  );
}
