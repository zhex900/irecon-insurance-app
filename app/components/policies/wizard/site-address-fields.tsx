import { useMemo } from "react";
import { useFormContext } from "react-hook-form";

import { FormAutocomplete } from "~/components/forms/autocomplete";
import { FieldInput } from "~/components/ui/form-controls";
import type { State } from "~/lib/db/types";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

export function SitePostcodeAndStateFields({ states }: { states: State[] }) {
  const {
    register,
    formState: { errors },
  } = useFormContext<CarPolicyFormValues>();

  const stateOptions = useMemo(
    () =>
      states.map((state) => ({
        value: state.stateId,
        label: state.code,
        secondary: state.name,
        searchText: `${state.code} ${state.name}`,
      })),
    [states],
  );

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <FormAutocomplete
        name="stateId"
        label="State"
        required
        error={errors.stateId?.message}
        options={stateOptions}
        placeholder="Search state…"
        emptyValue={0}
        emptyMessage="No match."
      />
      <FieldInput
        id="postcode"
        label="Postcode"
        required
        inputMode="numeric"
        autoComplete="postal-code"
        maxLength={4}
        placeholder="e.g. 2000"
        error={errors.postcode?.message}
        {...register("postcode")}
      />
    </div>
  );
}
