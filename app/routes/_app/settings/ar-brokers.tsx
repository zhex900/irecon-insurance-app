import { useEffect, useMemo, useRef, useState } from "react";
import {
  Form,
  useActionData,
  useNavigation,
  useSearchParams,
  useSubmit,
} from "react-router";
import { useForm } from "react-hook-form";
import { flattenFieldErrors, focusFormIssue } from "~/lib/form-validation-ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { BadgeCheckIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import { useActionSuccessToast } from "~/hooks/use-success-toast";
import { PageHeader } from "~/components/layout/app-layout";
import { SettingsBackLink } from "~/components/layout/settings-back-link";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "~/components/ui/table";
import { requireAuth } from "~/lib/auth/session.server";
import type { WholesaleBroker } from "~/lib/db/types";
import { writeAuditLog } from "~/lib/services/audit/service";
import { TablePagination } from "~/components/ui/table-pagination";
import {
  pageSearchHref,
  pageSizeSearchHref,
  parsePagination,
} from "~/lib/pagination";
import { listAuthorisedRepresentativesPage } from "~/lib/services/authorised-representatives/list.service";
import {
  createAuthorisedRepresentative,
  deleteAuthorisedRepresentative,
  getAuthorisedRepresentative,
  updateAuthorisedRepresentative,
} from "~/lib/services/authorised-representatives/service";
import { cn } from "~/lib/utils";
import {
  authorisedRepresentativeSchema,
  type AuthorisedRepresentativeFormValues,
} from "~/lib/zod/authorised-representative";
import type { Route } from "./+types/ar-brokers";

export function meta() {
  return [{ title: "Authorised Representatives | BrokerSure" }];
}

const PAGE_SIZE = 25;

export async function loader({ request }: Route.LoaderArgs) {
  await requireAuth(request);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
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
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "delete") {
    const id = Number(formData.get("id"));
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
        error: error instanceof Error ? error.message : "Delete failed",
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
        const created = await createAuthorisedRepresentative(parsed.data);
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
      const id = Number(formData.get("id"));
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
        error: error instanceof Error ? error.message : "Save failed",
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

  // Close dialog after successful save
  if (
    open &&
    actionData?.ok &&
    (actionData.intent === "create" || actionData.intent === "update") &&
    navigation.state === "idle"
  ) {
    // defer close to avoid render-phase setState; use effect-like pattern via timeout
    queueMicrotask(() => onOpenChange(false));
  }

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
            <LoadingButton
              type="submit"
              loading={saving}
              loadingLabel={editing ? "Saving…" : "Adding…"}
            >
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
  const [search, setSearch] = useState(loaderData.q);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<WholesaleBroker | null>(null);
  const [deleting, setDeleting] = useState<WholesaleBroker | null>(null);
  const submit = useSubmit();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const [searchParams] = useSearchParams();
  useActionSuccessToast(actionData);

  const brokers = loaderData.brokers;

  const filteredHint = useMemo(() => {
    if (!loaderData.q.trim()) return `${loaderData.total} representatives`;
    return `${loaderData.total} match${loaderData.total === 1 ? "" : "es"} for “${loaderData.q}”`;
  }, [loaderData.total, loaderData.q]);

  const pageHref = (nextPage: number) => pageSearchHref(searchParams, nextPage);
  const pageSizeHref = (nextPageSize: number) =>
    pageSizeSearchHref(searchParams, nextPageSize, PAGE_SIZE);

  const lastQRef = useRef(loaderData.q);
  useEffect(() => {
    if (lastQRef.current === loaderData.q) return;
    lastQRef.current = loaderData.q;
    setSearch(loaderData.q);
  }, [loaderData.q]);

  // Debounced server-side search via ?q= (SQL ilike in listAuthorisedRepresentativesPage).
  useEffect(() => {
    const trimmed = search.trim();
    const current = loaderData.q.trim();
    if (trimmed === current) return;

    const handle = window.setTimeout(() => {
      const params = new URLSearchParams();
      if (trimmed) params.set("q", trimmed);
      // Always reset to page 1 when the query changes.
      submit(params, { method: "get", replace: true });
    }, 300);

    return () => window.clearTimeout(handle);
  }, [search, loaderData.q, submit]);

  const handledDeleteActionDataRef = useRef(actionData);
  useEffect(() => {
    if (navigation.state !== "idle") return;
    if (handledDeleteActionDataRef.current === actionData) return;
    handledDeleteActionDataRef.current = actionData;
    const handled = handledDeleteActionDataRef.current;
    if (!handled?.ok || handled.intent !== "delete") return;
    setDeleting(null);
  }, [actionData, navigation.state]);

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  function openEdit(ar: WholesaleBroker) {
    setEditing(ar);
    setEditorOpen(true);
  }

  function clearSearch() {
    setSearch("");
    submit(new URLSearchParams(), { method: "get", replace: true });
  }

  function applySearch(event: React.FormEvent) {
    event.preventDefault();
    const params = new URLSearchParams();
    if (search.trim()) params.set("q", search.trim());
    submit(params, { method: "get", replace: true });
  }

  return (
    <div>
      <SettingsBackLink />
      <PageHeader
        title="Authorised Representatives"
        description="Manage brokers available in the client AR autocomplete."
        action={
          <Button type="button" onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            Add AR
          </Button>
        }
      />

      <form
        onSubmit={applySearch}
        className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="relative w-full max-w-md">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, company, AR number, email…"
            className={cn("w-full", search.trim() && "pr-9")}
            aria-label="Search authorised representatives"
          />
          {search.trim() ? (
            <button
              type="button"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
              onClick={clearSearch}
            >
              <XIcon className="size-3.5" />
            </button>
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">{filteredHint}</p>
      </form>

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
                        {loaderData.q.trim()
                          ? "No match"
                          : "No authorised representatives"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {loaderData.q.trim()
                          ? `No match for “${loaderData.q.trim()}”.`
                          : "No authorised representatives found."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              brokers.map((ar) => (
                <TableRow
                  key={ar.authorisedRepresentativeId}
                  className="cursor-pointer"
                  onClick={() => openEdit(ar)}
                >
                  <TableCell className="font-medium">{ar.fullName}</TableCell>
                  <TableCell>{ar.companyName}</TableCell>
                  <TableCell className="tabular-nums">{ar.arNumber}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {ar.email}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Delete ${ar.fullName}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDeleting(ar);
                      }}
                    >
                      <Trash2Icon />
                    </Button>
                  </TableCell>
                </TableRow>
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
                loadingLabel="Deleting…"
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
