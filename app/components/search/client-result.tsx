import { PhoneIcon } from "lucide-react";

import { HighlightText } from "~/components/search/highlight";
import { type ClientSearchResult } from "~/lib/search/client-match";
import { fieldMatches } from "~/lib/search/match";

export type { ClientSearchResult } from "~/lib/search/client-match";

/** Shared client hit body — same layout/highlights as global search. */
export function ClientSearchResultDetails({
  client,
  query,
}: {
  client: ClientSearchResult;
  query: string;
}) {
  const showTrading = Boolean(client.tradingName);
  const showAbn = Boolean(client.abn);
  const showPhone = Boolean(client.phone);

  const matchedFields = (
    [
      { label: "Email", value: client.email },
      { label: "Account Manager", value: client.accountManagerName },
      { label: "AR Company Name", value: client.arCompanyName },
      { label: "AR Name", value: client.arName },
    ] as const
  ).filter((field) => fieldMatches(field.value, query));

  return (
    <span className="min-w-0 flex-1">
      <span className="block truncate font-medium">
        <HighlightText text={client.name} query={query} />
      </span>
      <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-muted-foreground">
        {showTrading ? (
          <span className="truncate">
            <HighlightText text={client.tradingName} query={query} />
          </span>
        ) : null}
        {showTrading && (showAbn || showPhone) ? (
          <span aria-hidden>·</span>
        ) : null}
        {showAbn ? (
          <span className="shrink-0">
            ABN <HighlightText text={client.abn} query={query} />
          </span>
        ) : null}
        {showAbn && showPhone ? <span aria-hidden>·</span> : null}
        {showPhone ? (
          <span className="inline-flex shrink-0 items-center gap-1">
            <PhoneIcon className="size-3" aria-hidden />
            <HighlightText text={client.phone} query={query} />
          </span>
        ) : null}
        {!showTrading && !showAbn && !showPhone && matchedFields.length === 0
          ? "—"
          : null}
      </span>
      {matchedFields.length > 0 ? (
        <span className="mt-1 flex min-w-0 flex-col gap-0.5 text-xs">
          {matchedFields.map((field) => (
            <span key={field.label} className="truncate text-muted-foreground">
              <span className="font-medium text-foreground/70">
                {field.label}:{" "}
              </span>
              <HighlightText text={field.value} query={query} />
            </span>
          ))}
        </span>
      ) : null}
    </span>
  );
}
