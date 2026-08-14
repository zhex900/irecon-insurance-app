import { FormAutocomplete } from "~/components/forms/autocomplete";
import type { WholesaleBroker } from "~/lib/db/types";

export function Autocomplete({
  options,
  name = "authorisedRepresentativeId",
  label = "Authorised Representative",
  error,
}: {
  options: WholesaleBroker[];
  name?: string;
  label?: string;
  error?: string;
}) {
  return (
    <FormAutocomplete
      name={name}
      label={label}
      error={error}
      emptyValue={0}
      placeholder="Search authorised representative…"
      emptyMessage="No match."
      options={options.map((item) => ({
        value: item.authorisedRepresentativeId,
        label: [
          item.fullName,
          item.companyName ? `— ${item.companyName}` : "",
          item.arNumber ? `(${item.arNumber})` : "",
        ]
          .filter(Boolean)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
        secondary: [item.companyName, item.arNumber]
          .filter(Boolean)
          .join(" · "),
        searchText: [item.fullName, item.companyName, item.arNumber, item.email]
          .filter(Boolean)
          .join(" "),
      }))}
    />
  );
}
