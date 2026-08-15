import { FilterAutocomplete } from "~/components/forms/autocomplete";
import { ListSearchField } from "~/components/forms/list-search-field";
import { Button } from "~/components/ui/button";
import { Field, FieldGroup, FieldLabel } from "~/components/ui/field";
import { FilterTag } from "~/components/ui/status-badge";

export type FilterOption = {
  value: number | string;
  label: string;
  secondary?: string;
  searchText?: string;
};

export type ClientsIndexFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchClear: () => void;
  accountManagerId: number | null;
  authorisedRepresentativeId: number | null;
  arCompanyName: string;
  policyFilter: "all" | "with" | "without";
  accountManagerOptions: FilterOption[];
  arCompanyOptions: FilterOption[];
  arNameOptions: FilterOption[];
  total: number;
  withPolicies: number;
  withoutPolicies: number;
  allMatching: number;
  hasActiveFilters: boolean;
  onApplyFilters: (next?: {
    search?: string;
    accountManagerId?: number | null;
    authorisedRepresentativeId?: number | null;
    arCompanyName?: string;
    policyFilter?: "all" | "with" | "without";
    page?: number;
  }) => void;
  onClearFilters: () => void;
};

export function TableFilters({
  search,
  onSearchChange,
  onSearchClear,
  accountManagerId,
  authorisedRepresentativeId,
  arCompanyName,
  policyFilter,
  accountManagerOptions,
  arCompanyOptions,
  arNameOptions,
  total,
  withPolicies,
  withoutPolicies,
  allMatching,
  hasActiveFilters,
  onApplyFilters,
  onClearFilters,
}: ClientsIndexFiltersProps) {
  return (
    <>
      <form
        className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-4"
        onSubmit={(event) => {
          event.preventDefault();
          onApplyFilters({ page: 1 });
        }}
      >
        <FieldGroup className="gap-3">
          <Field>
            <FieldLabel htmlFor="client-search-q">Search</FieldLabel>
            <ListSearchField
              id="client-search-q"
              value={search}
              onChange={onSearchChange}
              onClear={onSearchClear}
              placeholder="Name, trading name, ABN, phone…"
              aria-label="Search clients"
              className="max-w-none"
            />
          </Field>
          <div className="grid gap-3 md:grid-cols-3">
            <FilterAutocomplete
              id="filter-account-manager"
              label="Account Manager"
              value={accountManagerId ?? ""}
              onChange={(value) => {
                const next = value === "" ? null : Number(value);
                onApplyFilters({ accountManagerId: next, page: 1 });
              }}
              options={accountManagerOptions}
              placeholder="All account managers"
            />
            <FilterAutocomplete
              id="filter-ar-company"
              label="AR Company Name"
              value={arCompanyName}
              onChange={(value) => {
                const next = value === "" ? "" : String(value);
                onApplyFilters({ arCompanyName: next, page: 1 });
              }}
              options={arCompanyOptions}
              placeholder="All AR companies"
            />
            <FilterAutocomplete
              id="filter-ar-name"
              label="AR Name"
              value={authorisedRepresentativeId ?? ""}
              onChange={(value) => {
                const next = value === "" ? null : Number(value);
                onApplyFilters({ authorisedRepresentativeId: next, page: 1 });
              }}
              options={arNameOptions}
              placeholder="All AR names"
            />
          </div>
        </FieldGroup>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {hasActiveFilters ? (
              <Button type="button" variant="outline" onClick={onClearFilters}>
                Clear filters
              </Button>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            {total} clients found · {withPolicies} with policies
          </p>
        </div>
      </form>

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterTag
          active={policyFilter === "all"}
          onClick={() => onApplyFilters({ policyFilter: "all", page: 1 })}
        >
          All · {allMatching}
        </FilterTag>
        <FilterTag
          active={policyFilter === "with"}
          onClick={() => onApplyFilters({ policyFilter: "with", page: 1 })}
        >
          With policies · {withPolicies}
        </FilterTag>
        <FilterTag
          active={policyFilter === "without"}
          onClick={() => onApplyFilters({ policyFilter: "without", page: 1 })}
        >
          No policies · {withoutPolicies}
        </FilterTag>
      </div>
    </>
  );
}
