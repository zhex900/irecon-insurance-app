import { useMemo, useState } from "react";
import {
  Form,
  redirect,
  useActionData,
  useNavigation,
  useSubmit,
} from "react-router";
import { Controller, useForm } from "react-hook-form";
import { flattenFieldErrors, focusFormIssue } from "~/lib/form-validation-ui";
import { zodResolver } from "@hookform/resolvers/zod";
import { FileTextIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { ListSearchField } from "~/components/forms/list-search-field";
import { useHandledActionData } from "~/hooks/use-handled-action-data";
import { useActionSuccessToast } from "~/hooks/use-success-toast";
import { useDebouncedSearchQuery } from "~/hooks/use-debounced-search-query";
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
import { WordingHtmlView } from "~/components/policies/wording-html-view";
import { WordingRichEditor } from "~/components/policies/wording-rich-editor";
import { FieldInput } from "~/components/ui/form-controls";
import { isAdminRole, isSuperAdmin } from "~/lib/auth/roles";
import { requireAuth } from "~/lib/auth/session.server";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import {
  parseFormIntent,
  parsePositiveInteger,
  queryTextSchema,
} from "~/lib/http/route-input";
import type { CarWording } from "~/lib/db/types";
import { writeAuditLog } from "~/lib/services/audit/service";
import { isFeatureEnabled } from "~/lib/services/feature-flags";
import { SearchHighlight } from "~/components/search/highlight-cell";
import { TablePagination } from "~/components/ui/table-pagination";
import {
  pageSearchHref,
  pageSizeSearchHref,
  parsePagination,
} from "~/lib/pagination";
import {
  createCarWording,
  deleteCarWording,
  getCarWordingById,
  listCarWordingsPage,
  updateCarWording,
} from "~/lib/services/car-wording/service";
import { plainTextFromWordingHtml } from "~/lib/policies/wording/html";
import {
  carWordingFormSchema,
  type CarWordingFormInput,
  type CarWordingFormValues,
} from "~/lib/zod/car-wording";
import type { Route } from "./+types/car-wording";
import { pageTitle } from "~/lib/brand";

export function meta() {
  return [{ title: pageTitle("Additional Wording") }];
}

const PAGE_SIZE = 25;

export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  const enabled = await isFeatureEnabled("additional_wording");
  if (!enabled && !isSuperAdmin(viewer)) {
    throw redirect("/settings");
  }
  const url = new URL(request.url);
  const q = queryTextSchema.parse(url.searchParams.get("q") ?? "");
  const pagination = parsePagination(url, { defaultSize: PAGE_SIZE });
  const page = await listCarWordingsPage({
    search: q || undefined,
    limit: pagination.limit,
    offset: pagination.offset,
  });
  return {
    wordings: page.rows,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    q,
    canEdit: isAdminRole(viewer),
    additionalWordingEnabled: enabled,
  };
}

export async function action({ request }: Route.ActionArgs) {
  const actor = await requireAuth(request);
  if (!isAdminRole(actor)) {
    return { ok: false as const, error: "Admin access required." };
  }
  const enabled = await isFeatureEnabled("additional_wording");
  if (!enabled && !isSuperAdmin(actor)) {
    return { ok: false as const, error: "Additional Wording is disabled." };
  }

  const formData = await request.formData();
  const intent = parseFormIntent(formData, ["create", "update", "delete"]);

  if (intent === "delete") {
    const id = parsePositiveInteger(formData.get("id"));
    if (!id) return { ok: false as const, error: "Missing id" };
    try {
      const existing = await getCarWordingById(id);
      await deleteCarWording(id);
      await writeAuditLog({
        actor,
        action: "car_wording.delete",
        entityType: "car_wording",
        entityId: id,
        summary: `Deleted additional wording ${existing?.subject ?? id}`,
        metadata: { subject: existing?.subject },
        request,
      });
      return {
        ok: true as const,
        intent: "delete" as const,
        message: `Wording “${existing?.subject ?? id}” deleted`,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Delete failed",
          operation: "car_wording_delete",
        }),
      };
    }
  }

  if (intent === "create" || intent === "update") {
    const parsed = carWordingFormSchema.safeParse({
      subject: formData.get("subject"),
      content: formData.get("content"),
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
        const created = await createCarWording(parsed.data);
        await writeAuditLog({
          actor,
          action: "car_wording.create",
          entityType: "car_wording",
          entityId: created.carWordingId,
          summary: `Created additional wording ${created.subject}`,
          metadata: { subject: created.subject },
          request,
        });
        return {
          ok: true as const,
          intent,
          message: `Wording “${created.subject}” added`,
        };
      }
      const id = parsePositiveInteger(formData.get("id"));
      if (!id) return { ok: false as const, error: "Missing id" };
      const updated = await updateCarWording(id, parsed.data);
      await writeAuditLog({
        actor,
        action: "car_wording.update",
        entityType: "car_wording",
        entityId: id,
        summary: `Updated additional wording ${updated.subject}`,
        metadata: { subject: updated.subject },
        request,
      });
      return {
        ok: true as const,
        intent,
        message: `Wording “${updated.subject}” updated`,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Save failed",
          operation: "car_wording_save",
        }),
      };
    }
  }

  return { ok: false as const, error: "Unknown action" };
}

function WordingFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: CarWording | null;
}) {
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const submit = useSubmit();
  const saving =
    navigation.state === "submitting" &&
    (navigation.formData?.get("intent") === "create" ||
      navigation.formData?.get("intent") === "update");

  const form = useForm<CarWordingFormInput, unknown, CarWordingFormValues>({
    resolver: zodResolver(carWordingFormSchema),
    values: {
      subject: plainTextFromWordingHtml(editing?.subject ?? ""),
      content: editing?.content ?? "",
    },
  });

  function onSubmit(values: CarWordingFormValues) {
    const data = new FormData();
    data.set("intent", editing ? "update" : "create");
    if (editing) data.set("id", String(editing.carWordingId));
    data.set("subject", values.subject);
    data.set("content", values.content);
    submit(data, { method: "post" });
  }

  useHandledActionData(actionData, {
    enabled: open,
    intents: ["create", "update"],
    onSuccess: () => onOpenChange(false),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl" showCloseButton>
        <DialogHeader>
          <DialogTitle>
            {editing ? "Edit additional wording" : "Add additional wording"}
          </DialogTitle>
          <DialogDescription>
            These options appear as checkboxes on the policy Additional Wording
            step and feed EndorsementSubject / EndorsementContent on schedules.
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
          <Controller
            control={form.control}
            name="subject"
            render={({ field }) => (
              <FieldInput
                id="subject"
                name={field.name}
                label="Subject"
                required
                value={field.value}
                onBlur={field.onBlur}
                onChange={field.onChange}
                className="[&_input]:font-semibold"
                placeholder="Endorsement title (always bold on schedules)"
                error={form.formState.errors.subject?.message}
              />
            )}
          />

          <Controller
            control={form.control}
            name="content"
            render={({ field }) => (
              <WordingRichEditor
                id="content"
                label="Content"
                required
                variant="content"
                value={field.value}
                onChange={field.onChange}
                error={form.formState.errors.content?.message}
              />
            )}
          />

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

export default function SettingsCarWordingRoute({
  loaderData,
}: Route.ComponentProps) {
  const { search, setSearch, clearSearch, searchQuery, searchParams } =
    useDebouncedSearchQuery(loaderData.q);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<CarWording | null>(null);
  const [deleting, setDeleting] = useState<CarWording | null>(null);
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  useActionSuccessToast(actionData);

  const wordings = loaderData.wordings;
  const canEdit = loaderData.canEdit;

  const filteredHint = useMemo(() => {
    if (!searchQuery)
      return `${loaderData.total} wording${loaderData.total === 1 ? "" : "s"}`;
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

  function openEdit(item: CarWording) {
    setEditing(item);
    setEditorOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="Additional Wording"
        description="Catalogue of endorsement wordings brokers can tick on a policy."
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Additional Wording" },
        ]}
        action={
          canEdit ? (
            <Button type="button" onClick={openCreate}>
              <PlusIcon data-icon="inline-start" />
              Add wording
            </Button>
          ) : null
        }
      />

      <div className="mb-4 flex flex-col gap-3 rounded-xl border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <ListSearchField
          value={search}
          onChange={setSearch}
          onClear={clearSearch}
          placeholder="Search subject or content…"
          aria-label="Search additional wording"
        />
        <p className="text-sm text-muted-foreground">{filteredHint}</p>
      </div>

      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">ID</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Content</TableHead>
              {canEdit ? (
                <TableHead className="w-28 text-right">Actions</TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {wordings.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canEdit ? 4 : 3} className="py-10">
                  <Empty>
                    <EmptyHeader>
                      <EmptyMedia variant="icon">
                        <FileTextIcon />
                      </EmptyMedia>
                      <EmptyTitle>
                        {searchQuery ? "No match" : "No additional wording"}
                      </EmptyTitle>
                      <EmptyDescription>
                        {searchQuery
                          ? `No match for “${searchQuery}”.`
                          : "Add catalogue wordings for the policy Additional Wording step."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              wordings.map((item) => (
                <InteractiveTableRow
                  key={item.carWordingId}
                  disabled={!canEdit}
                  aria-label={`Edit wording ${plainTextFromWordingHtml(item.subject)}`}
                  onActivate={() => openEdit(item)}
                >
                  <TableCell className="text-muted-foreground tabular-nums">
                    {item.carWordingId}
                  </TableCell>
                  <TableCell className="font-semibold">
                    <SearchHighlight
                      text={plainTextFromWordingHtml(item.subject)}
                      query={searchQuery}
                    />
                  </TableCell>
                  <TableCell className="max-w-xl">
                    {searchQuery ? (
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        <SearchHighlight
                          text={plainTextFromWordingHtml(item.content)}
                          query={searchQuery}
                        />
                      </p>
                    ) : (
                      <WordingHtmlView
                        html={item.content}
                        className="text-muted-foreground"
                        clampLines={2}
                      />
                    )}
                  </TableCell>
                  {canEdit ? (
                    <InteractiveTableActionsCell className="text-right">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Delete ${item.subject}`}
                        onClick={() => setDeleting(item)}
                      >
                        <Trash2Icon />
                      </Button>
                    </InteractiveTableActionsCell>
                  ) : null}
                </InteractiveTableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="mt-4">
        <TablePagination
          page={loaderData.page}
          pageSize={loaderData.pageSize}
          total={loaderData.total}
          pageHref={pageHref}
          pageSizeHref={pageSizeHref}
        />
      </div>

      {canEdit ? (
        <WordingFormDialog
          open={editorOpen}
          onOpenChange={setEditorOpen}
          editing={editing}
        />
      ) : null}

      <Dialog
        open={deleting != null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton>
          <DialogHeader>
            <DialogTitle>Delete wording?</DialogTitle>
            <DialogDescription>
              Remove “
              {deleting
                ? plainTextFromWordingHtml(deleting.subject) || deleting.subject
                : ""}
              ” from the catalogue. Policies that already selected it keep their
              ID, but it will no longer appear as a tick option.
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
                value={deleting ? String(deleting.carWordingId) : ""}
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
