import { useMemo, useState } from "react";
import { Form, useActionData, useNavigation, useSubmit } from "react-router";
import { useForm } from "react-hook-form";
import { flattenFieldErrors, focusFormIssue } from "~/lib/form-validation-ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { ContactIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { ListSearchField } from "~/components/forms/list-search-field";
import { useHandledActionData } from "~/hooks/utilities";
import { useActionSuccessToast } from "~/hooks/utilities";
import { useDebouncedSearchQuery } from "~/hooks/search";
import { PageHeader } from "~/components/layout/app-layout";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { requireAuth } from "~/lib/auth/session/server.server";
import { isSuperAdmin } from "~/lib/auth/roles";
import {
  requireAdminPage,
  requireFeatureOrSuperAdminPage,
} from "~/lib/auth/authorize.server";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import {
  parseFormIntent,
  parsePositiveInteger,
  queryTextSchema,
} from "~/lib/http/route-input";
import type { AccountManager } from "~/lib/db/types";
import { writeAuditLog } from "~/lib/services/audit/service";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import { SearchHighlight } from "~/components/search/highlight-cell";
import { TablePagination } from "~/components/ui/table-pagination";
import {
  pageSearchHref,
  pageSizeSearchHref,
  parsePagination,
} from "~/lib/pagination";
import { listAccountManagersPage } from "~/lib/services/account-managers/list.service";
import {
  createAccountManager,
  deleteAccountManager,
  getAccountManager,
  updateAccountManager,
} from "~/lib/services/account-managers/service";
import {
  accountManagerSchema,
  type AccountManagerFormValues,
} from "~/lib/zod/account-manager";
import type { Route } from "./+types/account-managers";
import { pageTitle } from "~/lib/brand";

export function meta() {
  return [{ title: pageTitle("Account Managers") }];
}

const PAGE_SIZE = 25;

export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  requireAdminPage(viewer);
  const enabled = await isFeatureEnabled("account_managers");
  requireFeatureOrSuperAdminPage(enabled, viewer);
  const url = new URL(request.url);
  const q = queryTextSchema.parse(url.searchParams.get("q") ?? "");
  const pagination = parsePagination(url, { defaultSize: PAGE_SIZE });
  const page = await listAccountManagersPage({
    search: q || undefined,
    limit: pagination.limit,
    offset: pagination.offset,
  });
  return {
    managers: page.rows,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    q,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const actor = await requireAuth(request);
  requireAdminPage(actor);
  const enabled = await isFeatureEnabled("account_managers");
  if (!enabled && !isSuperAdmin(actor)) {
    return { ok: false as const, error: "Account Managers is disabled." };
  }
  const formData = await request.formData();
  const intent = parseFormIntent(formData, ["create", "update", "delete"]);

  if (intent === "delete") {
    const id = parsePositiveInteger(formData.get("id"));
    if (!id) return { ok: false as const, error: "Missing id" };
    try {
      const existing = await getAccountManager(id);
      await deleteAccountManager(id);
      await writeAuditLog({
        actor,
        action: "account_manager.delete",
        entityType: "account_manager",
        entityId: id,
        summary: `Deleted account manager ${existing?.fullName ?? id}`,
        metadata: {
          fullName: existing?.fullName,
          email: existing?.email,
        },
        request,
      });
      return {
        ok: true as const,
        intent: "delete" as const,
        message: `Account manager ${existing?.fullName ?? id} deleted`,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Delete failed",
          operation: "account_manager_delete",
        }),
      };
    }
  }

  if (intent === "create" || intent === "update") {
    const parsed = accountManagerSchema.safeParse({
      fullName: formData.get("fullName"),
      abbrev: formData.get("abbrev"),
      email: formData.get("email"),
      arNumber: formData.get("arNumber"),
      mobile: formData.get("mobile"),
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
        const created = await createAccountManager(parsed.data, actor.email);
        await writeAuditLog({
          actor,
          action: "account_manager.create",
          entityType: "account_manager",
          entityId: created.accountManagerId,
          summary: `Created account manager ${created.fullName}`,
          metadata: {
            fullName: created.fullName,
            email: created.email,
          },
          request,
        });
        return {
          ok: true as const,
          intent,
          message: `Account manager ${created.fullName} added`,
        };
      }
      const id = parsePositiveInteger(formData.get("id"));
      if (!id) return { ok: false as const, error: "Missing id" };
      const updated = await updateAccountManager(id, parsed.data);
      await writeAuditLog({
        actor,
        action: "account_manager.update",
        entityType: "account_manager",
        entityId: id,
        summary: `Updated account manager ${updated.fullName}`,
        metadata: {
          fullName: updated.fullName,
          email: updated.email,
        },
        request,
      });
      return {
        ok: true as const,
        intent,
        message: `Account manager ${updated.fullName} updated`,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Save failed",
          operation: "account_manager_save",
        }),
      };
    }
  }

  return { ok: false as const, error: "Unknown action" };
}

function AccountManagerFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: AccountManager | null;
}) {
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const saving =
    navigation.state === "submitting" &&
    (navigation.formData?.get("intent") === "create" ||
      navigation.formData?.get("intent") === "update");

  const form = useForm<AccountManagerFormValues>({
    resolver: zodResolver(accountManagerSchema),
    values: {
      fullName: editing?.fullName ?? "",
      abbrev: editing?.abbrev ?? "",
      email: editing?.email ?? "",
      arNumber: editing?.arNumber ?? "",
      mobile: editing?.mobile ?? "",
    },
  });

  function onSubmit(values: AccountManagerFormValues) {
    const data = new FormData();
    data.set("intent", editing ? "update" : "create");
    if (editing) data.set("id", String(editing.accountManagerId));
    data.set("fullName", values.fullName);
    data.set("abbrev", values.abbrev);
    data.set("email", values.email);
    data.set("arNumber", values.arNumber);
    data.set("mobile", values.mobile);
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
            {editing ? "Edit account manager" : "Add account manager"}
          </DialogTitle>
          <DialogDescription>
            These records power the account manager dropdown on client forms and
            email signatures.
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

          <Field data-invalid={form.formState.errors.abbrev ? true : undefined}>
            <FieldLabel htmlFor="abbrev">Abbreviation</FieldLabel>
            <Input
              id="abbrev"
              aria-invalid={!!form.formState.errors.abbrev}
              {...form.register("abbrev")}
            />
            {form.formState.errors.abbrev ? (
              <FieldError>{form.formState.errors.abbrev.message}</FieldError>
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

          <Field data-invalid={form.formState.errors.mobile ? true : undefined}>
            <FieldLabel htmlFor="mobile">Mobile</FieldLabel>
            <Input
              id="mobile"
              aria-invalid={!!form.formState.errors.mobile}
              {...form.register("mobile")}
            />
            {form.formState.errors.mobile ? (
              <FieldError>{form.formState.errors.mobile.message}</FieldError>
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

export default function SettingsAccountManagersRoute({
  loaderData,
}: Route.ComponentProps) {
  const { search, setSearch, clearSearch, searchQuery, searchParams } =
    useDebouncedSearchQuery(loaderData.q);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AccountManager | null>(null);
  const [deleting, setDeleting] = useState<AccountManager | null>(null);
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  useActionSuccessToast(actionData);

  const managers = loaderData.managers;

  const filteredHint = useMemo(() => {
    if (!searchQuery) return `${loaderData.total} account managers`;
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

  function openEdit(manager: AccountManager) {
    setEditing(manager);
    setEditorOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Account Managers"
        description="Manage account managers assigned to clients."
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Account Managers" },
        ]}
        action={
          <Button type="button" onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            Add account manager
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <ListSearchField
          value={search}
          onChange={setSearch}
          onClear={clearSearch}
          placeholder="Search name, abbreviation, email, AR number, mobile…"
          aria-label="Search account managers"
        />
        <p className="text-sm text-muted-foreground">{filteredHint}</p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Full name</TableHead>
              <TableHead>Abbreviation</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>AR number</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead className="w-28 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {managers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <ContactIcon />
                      </EmptyMedia>
                      <EmptyTitle>
                        {searchQuery ? "No match" : "No account managers"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {searchQuery
                          ? `No match for “${searchQuery}”.`
                          : "No account managers found."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              managers.map((manager) => (
                <InteractiveTableRow
                  key={manager.accountManagerId}
                  aria-label={`Edit ${manager.fullName}`}
                  onActivate={() => openEdit(manager)}
                >
                  <TableCell className="font-medium">
                    <SearchHighlight
                      text={manager.fullName}
                      query={searchQuery}
                    />
                  </TableCell>
                  <TableCell>
                    <SearchHighlight
                      text={manager.abbrev}
                      query={searchQuery}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    <SearchHighlight text={manager.email} query={searchQuery} />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    <SearchHighlight
                      text={manager.arNumber}
                      query={searchQuery}
                    />
                  </TableCell>
                  <TableCell className="tabular-nums">
                    <SearchHighlight
                      text={manager.mobile}
                      query={searchQuery}
                    />
                  </TableCell>
                  <InteractiveTableActionsCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${manager.fullName}`}
                      onClick={() => setDeleting(manager)}
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

      <AccountManagerFormDialog
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
            <DialogTitle>Delete account manager?</DialogTitle>
            <DialogDescription>
              This removes{" "}
              <span className="font-medium text-foreground">
                {deleting?.fullName}
              </span>{" "}
              from the list. Managers assigned to clients cannot be deleted.
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
                value={deleting?.accountManagerId ?? ""}
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
