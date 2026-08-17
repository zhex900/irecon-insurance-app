import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, type Resolver,useForm } from "react-hook-form";

import { JustSavedProvider } from "~/components/forms/field-save-highlight";
import type { Client, ReferenceData } from "~/lib/db/types";
import {
  clientDraftSchema,
  type ClientFormValues,
  clientSchema,
  clientToFormValues,
} from "~/lib/zod/client";

import { FormInner } from "./form-inner";

export function MainForm({
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
