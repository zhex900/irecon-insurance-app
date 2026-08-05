import { useId } from "react";
import { useFormContext } from "react-hook-form";
import { SitePostcodeAndStateFields } from "~/components/policies/wizard/site-address-fields";
import {
  FieldSavedTick,
  useFieldSaveState,
} from "~/components/forms/field-save-highlight";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/utils";
import type { State } from "~/lib/db/types";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

type SiteAddressFieldsProps = {
  className?: string;
  states: State[];
  /** When true, mirror site address into geographicalScopes (cover types 2/3). */
  syncGeographicalScope?: boolean;
};

/** Plain site address + postcode/state (no map or address lookup). */
export function SiteAddressAutocomplete({
  className,
  states,
  syncGeographicalScope = false,
}: SiteAddressFieldsProps) {
  const {
    register,
    setValue,
    formState: { errors },
  } = useFormContext<CarPolicyFormValues>();
  const fieldId = useId();
  const { saved, className: addressHighlight } =
    useFieldSaveState("siteAddress");

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <Field data-invalid={errors.siteAddress ? true : undefined}>
        <FieldLabel htmlFor={fieldId}>Site Address</FieldLabel>
        <div className="relative">
          <Input
            id={fieldId}
            aria-invalid={!!errors.siteAddress}
            autoComplete="street-address"
            className={cn(addressHighlight, saved && "pr-8")}
            {...register("siteAddress", {
              onChange: (e) => {
                if (syncGeographicalScope) {
                  setValue("geographicalScopes", e.target.value);
                }
              },
            })}
          />
          <FieldSavedTick name="siteAddress" />
        </div>
        {errors.siteAddress ? (
          <FieldError>{errors.siteAddress.message}</FieldError>
        ) : null}
      </Field>
      <SitePostcodeAndStateFields states={states} />
    </div>
  );
}
