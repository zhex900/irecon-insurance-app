import { useEffect, useMemo, useRef, useState } from "react";
import { useActionData } from "react-router";
import { PlusIcon } from "lucide-react";
import { useHandledActionData } from "~/hooks/use-handled-action-data";
import { useActionSuccessToast } from "~/hooks/use-success-toast";
import { useDebouncedSearchQuery } from "~/hooks/use-debounced-search-query";
import { PageHeader } from "~/components/layout/app-layout";
import {
  UserDeleteConfirmDialog,
  UserToggleConfirmDialog,
} from "~/components/settings/user-confirm-dialogs";
import { UserFormDialog } from "~/components/settings/user-form-dialog";
import { UsersTable } from "~/components/settings/users-table";
import { Button } from "~/components/ui/button";
import { requireAuth } from "~/lib/auth/session.server";
import { requireAdminPage } from "~/lib/auth/authorize.server";
import { getAvatarsBucket } from "~/lib/cloudflare.server";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import {
  parseFormIntent,
  positiveIntegerSchema,
  queryTextSchema,
} from "~/lib/http/route-input";
import type { AppUser } from "~/lib/db/types";
import { writeAuditLog } from "~/lib/services/audit/service";
import {
  pageSearchHref,
  pageSizeSearchHref,
  parsePagination,
} from "~/lib/pagination";
import { listUsersPage } from "~/lib/services/users/list.service";
import {
  createUser,
  deleteUser,
  getUser,
  setUserAvatarKey,
  setUserDisabled,
  updateUser,
} from "~/lib/services/users/service";
import { deleteUserAvatar, putUserAvatar } from "~/lib/storage/avatars.server";
import { parseAppUserFormData } from "~/lib/zod/app-user";
import type { Route } from "./+types/users";
import { pageTitle } from "~/lib/brand";

export function meta() {
  return [{ title: pageTitle("User Management") }];
}

const PAGE_SIZE = 25;

export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  requireAdminPage(viewer);
  const url = new URL(request.url);
  const q = queryTextSchema.parse(url.searchParams.get("q") ?? "");
  const parsedEditId = positiveIntegerSchema.safeParse(
    url.searchParams.get("edit"),
  );
  const editId = parsedEditId.success ? String(parsedEditId.data) : null;
  const pagination = parsePagination(url, { defaultSize: PAGE_SIZE });
  const [page, editUser] = await Promise.all([
    listUsersPage({
      search: q || undefined,
      limit: pagination.limit,
      offset: pagination.offset,
    }),
    editId ? getUser(editId) : Promise.resolve(null),
  ]);
  return {
    users: page.rows,
    total: page.total,
    page: page.page,
    pageSize: page.pageSize,
    q,
    editUser,
  };
}

async function applyAvatarUpload(
  context: Route.ActionArgs["context"],
  userId: string,
  formData: FormData,
) {
  const removeAvatar = String(formData.get("removeAvatar") ?? "") === "1";
  const avatar = formData.get("avatar");
  const bucket = getAvatarsBucket(context);

  if (removeAvatar) {
    if (bucket) await deleteUserAvatar(bucket, userId);
    await setUserAvatarKey(userId, null);
    return;
  }

  if (!(avatar instanceof File) || avatar.size <= 0) return;

  if (!bucket) {
    throw new Error(
      "Avatar storage (R2) is not configured. Add the AVATARS bucket binding.",
    );
  }
  const key = await putUserAvatar(bucket, userId, avatar);
  await setUserAvatarKey(userId, key);
}

export async function action({ request, context }: Route.ActionArgs) {
  const actor = await requireAuth(request);
  requireAdminPage(actor);
  const formData = await request.formData();
  const intent = parseFormIntent(formData, [
    "create",
    "update",
    "delete",
    "enable",
    "disable",
  ]);

  if (intent === "delete") {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { ok: false as const, error: "Missing id" };
    if (id === actor.userId) {
      return {
        ok: false as const,
        error: "You cannot delete your own account.",
      };
    }
    try {
      const target = await getUser(id);
      const bucket = getAvatarsBucket(context);
      if (bucket) await deleteUserAvatar(bucket, id);
      await deleteUser(id);
      await writeAuditLog({
        actor,
        action: "user.delete",
        entityType: "user",
        entityId: id,
        summary: `Deleted user ${target?.email ?? id}`,
        metadata: { email: target?.email, fullName: target?.fullName },
        request,
      });
      return {
        ok: true as const,
        intent: "delete" as const,
        message: `User ${target?.email ?? id} deleted`,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Delete failed",
          operation: "user_delete",
        }),
      };
    }
  }

  if (intent === "disable" || intent === "enable") {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { ok: false as const, error: "Missing id" };
    if (intent === "disable" && id === actor.userId) {
      return {
        ok: false as const,
        error: "You cannot disable your own account.",
      };
    }
    try {
      const updated = await setUserDisabled(id, intent === "disable");
      await writeAuditLog({
        actor,
        action: intent === "disable" ? "user.disable" : "user.enable",
        entityType: "user",
        entityId: id,
        summary: `${intent === "disable" ? "Disabled" : "Enabled"} user ${updated.email}`,
        metadata: { email: updated.email },
        request,
      });
      return {
        ok: true as const,
        intent,
        message:
          intent === "disable"
            ? `User ${updated.email} disabled`
            : `User ${updated.email} enabled`,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Update failed",
          operation: "user_status_update",
        }),
      };
    }
  }

  if (intent === "create" || intent === "update") {
    const parsed = parseAppUserFormData(
      {
        fullName: formData.get("fullName"),
        email: formData.get("email"),
        role: formData.get("role"),
        disabled: formData.get("disabled"),
        password: formData.get("password"),
        confirmPassword: formData.get("confirmPassword"),
      },
      intent === "create" ? "create" : "update",
    );
    if (!parsed.success) {
      return {
        ok: false as const,
        error: parsed.error.issues[0]?.message ?? "Invalid form",
        fieldErrors: parsed.error.flatten().fieldErrors,
      };
    }

    const { confirmPassword: _confirm, ...userFields } = parsed.data;
    const payload = {
      ...userFields,
      authorisedRepresentativeId: null,
    };

    try {
      if (intent === "create") {
        const created = await createUser(payload);
        await applyAvatarUpload(context, created.userId, formData);
        await writeAuditLog({
          actor,
          action: "user.create",
          entityType: "user",
          entityId: created.userId,
          summary: `Created user ${created.email}`,
          metadata: { email: created.email, role: created.role },
          request,
        });
        return {
          ok: true as const,
          intent,
          message: `User ${created.email} added`,
        };
      }
      const id = String(formData.get("id") ?? "").trim();
      if (!id) return { ok: false as const, error: "Missing id" };
      const updated = await updateUser(id, payload);
      await applyAvatarUpload(context, id, formData);
      await writeAuditLog({
        actor,
        action: "user.update",
        entityType: "user",
        entityId: id,
        summary: `Updated user ${updated.email}`,
        metadata: { email: updated.email, role: updated.role },
        request,
      });
      return {
        ok: true as const,
        intent,
        message: `User ${updated.email} updated`,
      };
    } catch (error) {
      return {
        ok: false as const,
        error: publicErrorMessage(error, {
          fallback: "Save failed",
          operation: "user_save",
        }),
      };
    }
  }

  return { ok: false as const, error: "Unknown action" };
}

export default function SettingsUsersRoute({
  loaderData,
}: Route.ComponentProps) {
  const {
    search,
    setSearch,
    clearSearch,
    searchQuery,
    searchParams,
    setSearchParams,
  } = useDebouncedSearchQuery(loaderData.q);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [toggling, setToggling] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);
  const actionData = useActionData<typeof action>();
  useActionSuccessToast(actionData);

  const filteredHint = useMemo(() => {
    if (!loaderData.q.trim()) return `${loaderData.total} users`;
    return `${loaderData.total} match${loaderData.total === 1 ? "" : "es"} for “${loaderData.q}”`;
  }, [loaderData.total, loaderData.q]);

  const pageHref = (nextPage: number) => pageSearchHref(searchParams, nextPage);
  const pageSizeHref = (nextPageSize: number) =>
    pageSizeSearchHref(searchParams, nextPageSize, PAGE_SIZE);

  const lastEditUserRef = useRef(loaderData.editUser);
  useEffect(() => {
    if (lastEditUserRef.current === loaderData.editUser) return;
    lastEditUserRef.current = loaderData.editUser;
    if (!lastEditUserRef.current) return;
    setEditing(lastEditUserRef.current);
    setEditorOpen(true);
  }, [loaderData.editUser]);

  useHandledActionData(actionData, {
    intents: ["delete", "enable", "disable"],
    onSuccess: () => {
      setDeleting(null);
      setToggling(null);
    },
  });

  function clearEditParam() {
    if (!searchParams.has("edit")) return;
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next, { replace: true });
  }

  function openCreate() {
    setEditing(null);
    setEditorOpen(true);
  }

  return (
    <div>
      <PageHeader
        title="User Management"
        description="Manage broker and admin users who can sign in to the portal."
        breadcrumbs={[
          { label: "Settings", to: "/settings" },
          { label: "Users" },
        ]}
        action={
          <Button type="button" onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            Add user
          </Button>
        }
      />

      <UsersTable
        users={loaderData.users}
        search={search}
        searchQuery={searchQuery}
        onSearchChange={setSearch}
        onClearSearch={clearSearch}
        filteredHint={filteredHint}
        total={loaderData.total}
        page={loaderData.page}
        pageSize={loaderData.pageSize}
        pageHref={pageHref}
        pageSizeHref={pageSizeHref}
        onEdit={(user) => {
          setEditing(user);
          setEditorOpen(true);
        }}
        onToggle={setToggling}
        onDelete={setDeleting}
      />

      <UserFormDialog
        open={editorOpen}
        onOpenChange={(open) => {
          setEditorOpen(open);
          if (!open) {
            setEditing(null);
            clearEditParam();
          }
        }}
        editing={editing}
      />

      <UserToggleConfirmDialog
        user={toggling}
        open={toggling != null}
        onOpenChange={(open) => {
          if (!open) setToggling(null);
        }}
      />

      <UserDeleteConfirmDialog
        user={deleting}
        open={deleting != null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      />
    </div>
  );
}
