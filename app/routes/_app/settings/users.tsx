import { useEffect, useMemo, useRef, useState } from "react";
import { useActionData, useNavigation, useSearchParams } from "react-router";
import { PlusIcon } from "lucide-react";
import { useActionSuccessToast } from "~/hooks/use-success-toast";
import { PageHeader } from "~/components/layout/app-layout";
import {
  UserDeleteConfirmDialog,
  UserToggleConfirmDialog,
} from "~/components/settings/user-confirm-dialogs";
import { UserFormDialog } from "~/components/settings/user-form-dialog";
import { UsersTable } from "~/components/settings/users-table";
import { Button } from "~/components/ui/button";
import { requireAuth } from "~/lib/auth/session.server";
import { getAvatarsBucket } from "~/lib/cloudflare.server";
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
  await requireAuth(request);
  const url = new URL(request.url);
  const q = url.searchParams.get("q") ?? "";
  const editId = url.searchParams.get("edit")?.trim() || null;
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
  const formData = await request.formData();
  const intent = String(formData.get("intent") ?? "");

  if (intent === "delete") {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { ok: false as const, error: "Missing id" };
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
        error: error instanceof Error ? error.message : "Delete failed",
      };
    }
  }

  if (intent === "disable" || intent === "enable") {
    const id = String(formData.get("id") ?? "").trim();
    if (!id) return { ok: false as const, error: "Missing id" };
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
        error: error instanceof Error ? error.message : "Update failed",
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
        error: error instanceof Error ? error.message : "Save failed",
      };
    }
  }

  return { ok: false as const, error: "Unknown action" };
}

export default function SettingsUsersRoute({
  loaderData,
}: Route.ComponentProps) {
  const [search, setSearch] = useState(loaderData.q);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<AppUser | null>(null);
  const [toggling, setToggling] = useState<AppUser | null>(null);
  const [deleting, setDeleting] = useState<AppUser | null>(null);
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();
  const [searchParams, setSearchParams] = useSearchParams();
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

  const handledActionDataRef = useRef(actionData);
  useEffect(() => {
    if (navigation.state !== "idle") return;
    if (handledActionDataRef.current === actionData) return;
    handledActionDataRef.current = actionData;
    const handled = handledActionDataRef.current;
    if (!handled?.ok) return;
    if (
      handled.intent === "delete" ||
      handled.intent === "enable" ||
      handled.intent === "disable"
    ) {
      setDeleting(null);
      setToggling(null);
    }
  }, [actionData, navigation.state]);

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
        onSearchChange={setSearch}
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
