import { Link } from "react-router";
import { useFormContext } from "react-hook-form";
import { ArAutocomplete as AuthorisedRepresentativeAutocomplete } from "~/components/clients/representatives";
import { FormAutocomplete } from "~/components/forms/autocomplete";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { FieldInput } from "~/components/ui/form-controls";
import { LoadingButton } from "~/components/ui/loading-button";
import {
  PolicySaveStatusBadge,
  type PolicySaveStatus,
} from "~/components/forms/field-save-highlight";
import type { ReferenceData } from "~/lib/db/types";
import type { ClientFormValues } from "~/lib/zod/client";

export function FormFields({
  reference,
  cancelTo,
  isNew,
  saveStatus,
  draftSaveError,
  manualSaving,
  onFieldBlur,
  onSave,
  onCancel,
}: {
  reference: ReferenceData;
  cancelTo: string;
  isNew: boolean;
  saveStatus: PolicySaveStatus;
  draftSaveError: string | null;
  manualSaving: boolean;
  onFieldBlur: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const {
    register,
    formState: { errors },
  } = useFormContext<ClientFormValues>();

  return (
    <Card className="max-w-3xl">
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle>Client details</CardTitle>
        {!isNew ? <PolicySaveStatusBadge status={saveStatus} /> : null}
      </CardHeader>
      <CardContent>
        <fieldset
          className="flex flex-col gap-6 border-0 p-0"
          onBlurCapture={onFieldBlur}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <FieldInput
              label="Registered Name"
              error={errors.name?.message}
              {...register("name")}
            />
            <FieldInput
              label="Trading Name"
              error={errors.tradingName?.message}
              {...register("tradingName")}
            />
            <FieldInput
              label="ABN"
              inputMode="numeric"
              hint="11 digits (optional)"
              error={errors.abn?.message}
              {...register("abn")}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FieldInput
              label="Phone"
              type="tel"
              autoComplete="tel"
              error={errors.phone?.message}
              {...register("phone")}
            />
            <FieldInput
              label="Email"
              type="email"
              error={errors.email?.message}
              {...register("email")}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <FormAutocomplete
              name="accountManagerId"
              label="Account Manager"
              error={errors.accountManagerId?.message}
              placeholder="Search account manager…"
              emptyMessage="No match."
              options={reference.accountManagers.map((item) => ({
                value: item.accountManagerId,
                label: item.fullName,
                secondary: item.abbrev || undefined,
                searchText: `${item.fullName} ${item.abbrev}`,
              }))}
            />
            <div className="md:col-span-2">
              <AuthorisedRepresentativeAutocomplete
                options={reference.wholesaleBrokers}
                error={errors.authorisedRepresentativeId?.message}
              />
            </div>
          </div>

          {draftSaveError ? (
            <p className="text-sm text-destructive">{draftSaveError}</p>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <LoadingButton
              type="button"
              onClick={onSave}
              loading={manualSaving}
            >
              Save
            </LoadingButton>
            {isNew ? (
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            ) : (
              <Link to={cancelTo}>
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            )}
          </div>
        </fieldset>
      </CardContent>
    </Card>
  );
}
