import { redirect } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, type Resolver } from "react-hook-form";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { FieldInput } from "~/components/ui/field";
import { Select } from "~/components/ui/select";
import { PageHeader } from "~/components/layout/app-layout";
import { clientSchema, type ClientFormValues } from "~/lib/zod/client";
import { createClient, getReferenceData } from "~/lib/services/store";
import type { Route } from "./+types/clients.new";

export function meta() {
  return [{ title: "New Client | CAR Broker Portal" }];
}

export async function loader() {
  return { reference: getReferenceData() };
}

export async function action({ request }: Route.ActionArgs) {
  const formData = await request.formData();
  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    tradingName: formData.get("tradingName"),
    entityTypeId: formData.get("entityTypeId"),
    accountManagerId: formData.get("accountManagerId"),
  });

  if (!parsed.success) {
    return {
      errors: parsed.error.flatten().fieldErrors,
      values: Object.fromEntries(formData),
    };
  }

  const client = await createClient(parsed.data);
  return redirect(`/clients/${client.clientId}`);
}

export default function NewClientRoute({
  loaderData,
  actionData,
}: Route.ComponentProps) {
  const form = useForm<ClientFormValues>({
    resolver: zodResolver(clientSchema) as Resolver<ClientFormValues>,
    defaultValues: {
      name: String(actionData?.values?.name ?? ""),
      tradingName: String(actionData?.values?.tradingName ?? ""),
      entityTypeId: Number(actionData?.values?.entityTypeId ?? 0),
      accountManagerId: Number(actionData?.values?.accountManagerId ?? 0),
    },
  });

  return (
    <div>
      <PageHeader title="New client" description="Create a client record before starting a CAR quote." />
      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle>Client details</CardTitle>
        </CardHeader>
        <CardContent>
          <form method="post" className="flex flex-col gap-4">
            <FieldInput
              label="Legal name"
              error={actionData?.errors?.name?.[0] ?? form.formState.errors.name?.message}
              {...form.register("name")}
            />
            <FieldInput
              label="Trading name"
              error={actionData?.errors?.tradingName?.[0] ?? form.formState.errors.tradingName?.message}
              {...form.register("tradingName")}
            />
            <Select
              label="Entity type"
              error={actionData?.errors?.entityTypeId?.[0]}
              {...form.register("entityTypeId")}
            >
              <option value="">Please select...</option>
              {loaderData.reference.entityTypes.map((item) => (
                <option key={item.entityTypeId} value={item.entityTypeId}>
                  {item.name}
                </option>
              ))}
            </Select>
            <Select
              label="Account manager"
              error={actionData?.errors?.accountManagerId?.[0]}
              {...form.register("accountManagerId")}
            >
              <option value="">Please select...</option>
              {loaderData.reference.accountManagers.map((item) => (
                <option key={item.accountManagerId} value={item.accountManagerId}>
                  {item.fullName}
                </option>
              ))}
            </Select>
            <div className="flex gap-3">
              <Button type="submit">Create client</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
