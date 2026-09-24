import { Badge } from "~/components/reui/badge";
import { SearchHighlight } from "~/components/search/highlight-cell";
import {
  formatPolicySeriesReference,
  policySeriesTermBadgeLabel,
} from "~/lib/policies/policy-series-term";
import { cn } from "~/lib/utils";

type PolicySeriesLabelProps = {
  seriesNumber: string;
  seriesTerm?: number;
  searchQuery?: string;
  className?: string;
  /** Series number typography (table vs header). */
  seriesClassName?: string;
};

export function PolicySeriesLabel({
  seriesNumber,
  seriesTerm = 0,
  searchQuery,
  className,
  seriesClassName,
}: PolicySeriesLabelProps) {
  const base = seriesNumber.trim();
  const badge = policySeriesTermBadgeLabel(seriesTerm);
  const highlightText = searchQuery?.trim()
    ? formatPolicySeriesReference(base, seriesTerm)
    : null;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 flex-nowrap items-center gap-1.5",
        className,
      )}
    >
      <span className={cn("font-medium", seriesClassName)}>
        {highlightText && searchQuery ? (
          <SearchHighlight text={highlightText} query={searchQuery} />
        ) : (
          base
        )}
      </span>
      {badge ? (
        <Badge variant="orange-light" size="sm" radius="full">
          {badge}
        </Badge>
      ) : null}
    </span>
  );
}
