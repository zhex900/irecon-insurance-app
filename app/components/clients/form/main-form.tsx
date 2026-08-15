import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { FormInner } from "./inner";
import { JustSavedProvider } from "~/components/forms/field-save-highlight";
import type { Client, ReferenceData } from "~/lib/db/types";
import {
  clientDraftSchema,
  clientSchema,
  clientToFormValues,
  type ClientFormValues,
} from "~/lib/zod/client";

export function Form({
  client,
  reference,
  cancelTo,
  isNew = false,
}: {
  client: Client;
  reference: ReferenceData;
  cancelTo: string;
  isNew?: boolean;
}) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(
      isNew ? clientSchema : clientDraftSchema,
    ) as Resolver<ClientFormValues>,
    defaultValues: clientToFormValues(client),
    mode: "onBlur",
  });

  return (
    <FormProvider {...form}>
      <JustSavedProvider>
        <FormInner
          client={client}
          reference={reference}
          cancelTo={cancelTo}
          isNew={isNew}
        />
      </JustSavedProvider>
    </FormProvider>
  );
}
