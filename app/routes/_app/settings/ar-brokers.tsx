import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheckIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Form, useActionData, useNavigation, useSubmit } from "react-router";

import { ListSearchField } from "~/components/forms/list-search-field";
import { PageHeader } from "~/components/layout/app-layout";
import { SearchHighlight } from "~/components/search/highlight-cell";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "~/components/ui/empty";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import {
  InteractiveTableActionsCell,
  InteractiveTableRow,
} from "~/components/ui/interactive-table-row";
import { LoadingButton } from "~/components/ui/loading-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { TablePagination } from "~/components/ui/table-pagination";
import { useDebouncedSearchQuery } from "~/hooks/search";
import { useActionSuccessToast,useHandledActionData  } from "~/hooks/utilities";
import { requireAdminPage } from "~/lib/auth/authorize.server";
import { requireAuth } from "~/lib/auth/session/server.server";
import { pageTitle } from "~/lib/brand";
import type { WholesaleBroker } from "~/lib/db/types";
import { flattenFieldErrors, focusFormIssue } from "~/lib/form-validation-ui";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import {
  parseFormIntent,
  parsePositiveInteger,
  queryTextSchema,
} from "~/lib/http/route-input";
import {
  pageSearchHref,
  pageSizeSearchHref,
  parsePagination,
} from "~/lib/pagination";
import { writeAuditLog } from "~/lib/services/audit/service";
import { listAuthorisedRepresentativesPage } from "~/lib/services/authorised-representatives/list.service";
import {
  createAuthorisedRepresentative,
  deleteAuthorisedRepresentative,
  getAuthorisedRepresentative,
  updateAuthorisedRepresentative,
} from "~/lib/services/authorised-representatives/service";
import {
  type AuthorisedRepresentativeFormValues,
  authorisedRepresentativeSchema,
} from "~/lib/zod/authorised-representative";

import type { Route } from "./+types/ar-brokers";

export function meta() {
  return [{ title: pageTitle("Authorised Representatives") }];
}

const PAGE_SIZE = 25;

export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  requireAdminPage(viewer);
  const url = new URL(request.url);
  const q = queryTextSchema.parse(url.searchParams.get("q") ?? "");
  const pagination = parsePagination(url, { defaultSize: PAGE_SIZE });
  const page = await listAuthorisedRepresentativesPage({
    search: q || undefined,
    limit: pagination.limit,
    offset: pagination.offset,
  });
  return {
    brokers: page.rows,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    q,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const actor = await requireAuth(request);
  requireAdminPage(actor);
  const formData = await request.formData();
  const intent = parseFormIntent(formData, ["create", "update", "delete"]);

  if (intent === "delete") {
    const id = parsePositiveInteger(formData.get("id"));
    if (!id) return { ok: false as const, error: "Missing id" };
    try {
      const existing = await getAuthorisedRepresentative(id);
      await deleteAuthorisedRepresentative(id);
      await writeAuditLog({
        actor,
        action: "ar.delete",
        entityType: "ar",
        entityId: id,
        summary: `Deleted AR ${existing?.fullName ?? id}`,
        metadata: {
          fullName: existing?.fullName,
          companyName: existing?.companyName,
        },
        request,
      });
      return {
        ok: true as const,
        intent: "delete" as const,
        message: `Authorised representative ${existing?.fullName ?? id} deleted`,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Delete failed",
          operation: "authorised_representative_delete",
        }),
      };
    }
  }

  if (intent === "create" || intent === "update") {
    const parsed = authorisedRepresentativeSchema.safeParse({
      fullName: formData.get("fullName"),
      companyName: formData.get("companyName"),
      arNumber: formData.get("arNumber"),
      email: formData.get("email"),
    });
    if (!parsed.success) {
      return {
        ok: false as const,
        error: parsed.error.issues[0]?.message ?? "Invalid form",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    try {
      if (intent === "create") {
        const created = await createAuthorisedRepresentative(
          parsed.data,
          actor.email,
        );
        await writeAuditLog({
          actor,
          action: "ar.create",
          entityType: "ar",
          entityId: created.authorisedRepresentativeId,
          summary: `Created AR ${created.fullName}`,
          metadata: {
            fullName: created.fullName,
            companyName: created.companyName,
          },
          request,
        });
        return {
          ok: true as const,
          intent,
          message: `Authorised representative ${created.fullName} added`,
        };
      }
      const id = parsePositiveInteger(formData.get("id"));
      if (!id) return { ok: false as const, error: "Missing id" };
      const updated = await updateAuthorisedRepresentative(id, parsed.data);
      await writeAuditLog({
        actor,
        action: "ar.update",
        entityType: "ar",
        entityId: id,
        summary: `Updated AR ${updated.fullName}`,
        metadata: {
          fullName: updated.fullName,
          companyName: updated.companyName,
        },
        request,
      });
      return {
        ok: true as const,
        intent,
        message: `Authorised representative ${updated.fullName} updated`,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Save failed",
          operation: "authorised_representative_save",
        }),
      };
    }
  }

  return { ok: false as const, error: "Unknown action" };
}

function ArFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: WholesaleBroker | null;
}) {
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const saving =
    navigation.state === "submitting" &&
    (navigation.formData?.get("intent") === "create" ||
      navigation.formData?.get("intent") === "update");

  const form = useForm<AuthorisedRepresentativeFormValues>({
    resolver: zodResolver(authorisedRepresentativeSchema),
    values: {
      fullName: editing?.fullName ?? "",
      companyName: editing?.companyName ?? "",
      arNumber: editing?.arNumber ?? "",
      email: editing?.email ?? "",
    },
  });

  function onSubmit(values: AuthorisedRepresentativeFormValues) {
    const data = new FormData();
    data.set("intent", editing ? "update" : "create");
    if (editing) data.set("id", String(editing.authorisedRepresentativeId));
    data.set("fullName", values.fullName);
    data.set("companyName", values.companyName);
    data.set("arNumber", values.arNumber);
    data.set("email", values.email);
    submit(data, { method: "post" });
  }

  useHandledActionData(actionData, {
    enabled: open,
    intents: ["create", "update"],
    onSuccess: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {editing
              ? "Edit authorised representative"
              : "Add authorised representative"}
          </DialogTitle>
          <DialogDescription>
            These records power the AR autocomplete on client forms.
          </DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-3"
          onSubmit={form.handleSubmit(onSubmit, (errors) => {
            const first = flattenFieldErrors(errors)[0];
            if (first) focusFormIssue(form.setFocus, first.path);
          })}
          noValidate
        >
          <Field
            data-invalid={form.formState.errors.fullName ? true : undefined}
          >
            <FieldLabel htmlFor="fullName">Full name</FieldLabel>
            <Input
              id="fullName"
              aria-invalid={!!form.formState.errors.fullName}
              {...form.register("fullName")}
            />
            {form.formState.errors.fullName ? (
              <FieldError>{form.formState.errors.fullName.message}</FieldError>
            ) : null}
          </Field>

          <Field
            data-invalid={form.formState.errors.companyName ? true : undefined}
          >
            <FieldLabel htmlFor="companyName">Company name</FieldLabel>
            <Input
              id="companyName"
              aria-invalid={!!form.formState.errors.companyName}
              {...form.register("companyName")}
            />
            {form.formState.errors.companyName ? (
              <FieldError>
                {form.formState.errors.companyName.message}
              </FieldError>
            ) : null}
          </Field>

          <Field
            data-invalid={form.formState.errors.arNumber ? true : undefined}
          >
            <FieldLabel htmlFor="arNumber">AR number</FieldLabel>
            <Input
              id="arNumber"
              aria-invalid={!!form.formState.errors.arNumber}
              {...form.register("arNumber")}
            />
            {form.formState.errors.arNumber ? (
              <FieldError>{form.formState.errors.arNumber.message}</FieldError>
            ) : null}
          </Field>

          <Field data-invalid={form.formState.errors.email ? true : undefined}>
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              type="email"
              aria-invalid={!!form.formState.errors.email}
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <FieldError>{form.formState.errors.email.message}</FieldError>
            ) : null}
          </Field>

          {actionData && !actionData.ok && actionData.error ? (
            <p className="text-sm text-destructive">{actionData.error}</p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <LoadingButton type="submit" loading={saving}>
              {editing ? "Save changes" : "Add"}
            </LoadingButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function SettingsArBrokersRoute({
  loaderData,
}: Route.ComponentProps) {
  const { search, setSearch, clearSearch, searchQuery, searchParams } =
    useDebouncedSearchQuery(loaderData.q);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<WholesaleBroker | null>(null);
  const [deleting, setDeleting] = useState<WholesaleBroker | null>(null);
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  useActionSuccessToast(actionData);

  const brokers = loaderData.brokers;

  const filteredHint = useMemo(() => {
    if (!searchQuery) return `${loaderData.total} representatives`;
    return `${loaderData.total} match${loaderData.total === 1 ? "" : "es"} for “${searchQuery}”`;
  }, [loaderData.total, searchQuery]);

  const pageHref = (nextPage: number) => pageSearchHref(searchParams, nextPage);
  const pageSizeHref = (nextPageSize: number) =>
    pageSizeSearchHref(searchParams, nextPageSize, PAGE_SIZE);

  useHandledActionData(actionData, {
    intents: "delete",
    onSuccess: () => setDeleting(null),
  });

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(ar: WholesaleBroker) {
    setEditing(ar);
    setEditorOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Authorised Representatives"
        description="Manage brokers available in the client AR autocomplete."
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Authorised Representatives" },
        ]}
        action={
          <Button type="button" onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            Add AR
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <ListSearchField
          value={search}
          onChange={setSearch}
          onClear={clearSearch}
          placeholder="Search name, company, AR number, email…"
          aria-label="Search authorised representatives"
        />
        <p className="text-sm text-muted-foreground">{filteredHint}</p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full name</TableHead>
              <TableHead>Company</TableHead>
              <TableHead>AR number</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {brokers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <BadgeCheckIcon />
                      </EmptyMedia>
                      <EmptyTitle>
                        {searchQuery
                          ? "No match"
                          : "No authorised representatives"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {searchQuery
                          ? `No match for “${searchQuery}”.`
                          : "No authorised representatives found."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              brokers.map((ar) => (
                <InteractiveTableRow
                  key={ar.authorisedRepresentativeId}
                  aria-label={`Edit ${ar.fullName}`}
                  onActivate={() => openEdit(ar)}
                >
                  <TableCell className="font-medium">
                    <SearchHighlight text={ar.fullName} query={searchQuery} />
                  </TableCell>
                  <TableCell>
                    <SearchHighlight
                      text={ar.companyName}
                      query={searchQuery}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    <SearchHighlight text={ar.arNumber} query={searchQuery} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <SearchHighlight text={ar.email} query={searchQuery} />
                  </TableCell>
                  <InteractiveTableActionsCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${ar.fullName}`}
                      onClick={() => setDeleting(ar)}
                    >
                      <Trash2Icon />
                    </Button>
                  </InteractiveTableActionsCell>
                </InteractiveTableRow>
              ))
            )}
          </TableBody>
        </Table>
        <TablePagination
          total={loaderData.total}
          page={loaderData.page}
          pageSize={loaderData.pageSize}
          pageHref={pageHref}
          pageSizeHref={pageSizeHref}
        />
      </div>

      <ArFormDialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) setEditing(null);
        }}
        editing={editing}
      />

      <Dialog
        open={deleting != null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Delete authorised representative?</DialogTitle>
            <DialogDescription>
              This removes{" "}
              <span className="font-medium text-foreground">
                {deleting?.fullName}
              </span>{" "}
              from the list. Existing clients keep their saved AR id.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Form method="post">
              <input type="hidden" name="intent" value="delete" />
              <input
                type="hidden"
                name="id"
                value={deleting?.authorisedRepresentativeId ?? ""}
              />
              <LoadingButton
                type="submit"
                variant="destructive"
                loading={
                  navigation.state === "submitting" &&
                  navigation.formData?.get("intent") === "delete"
                }
              >
                Delete
              </LoadingButton>
            </Form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
