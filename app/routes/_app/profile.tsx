import { useActionData } from "react-router";
import { PageHeader } from "~/components/layout/app-layout";
import { ProfileForm } from "~/components/profile/profile-form";
import { requireAuth } from "~/lib/auth/session.server";
import { isAdminRole } from "~/lib/auth/roles";
import { pageTitle } from "~/lib/brand";
import { getAvatarsBucket } from "~/lib/cloudflare.server";
import { publicErrorMessage } from "~/lib/http/public-error.server";
import { parseFormIntent } from "~/lib/http/route-input";
import { writeAuditLog } from "~/lib/services/audit/service";
import {
  getUser,
  setUserAvatarKey,
  updateOwnProfile,
} from "~/lib/services/users/service";
import { deleteUserAvatar, putUserAvatar } from "~/lib/storage/avatars.server";
import { parseProfileFormData } from "~/lib/zod/app-user";
import { useActionSuccessToast } from "~/hooks/use-success-toast";
import type { Route } from "./+types/profile";

export function meta() {
  return [{ title: pageTitle("Profile") }];
}

export async function loader({ request }: Route.LoaderArgs) {
  const viewer = await requireAuth(request);
  const user = await getUser(viewer.userId);
  if (!user) {
    throw new Response("User not found", { status: 404 });
  }
  return {
    user,
    canChangeRole: isAdminRole(viewer) && viewer.role !== "super-admin",
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
  const intent = parseFormIntent(formData, ["profile"], "profile");
  if (intent !== "profile") {
    return { ok: false as const, error: "Unknown action" };
  }

  const allowRoleChange = isAdminRole(actor) && actor.role !== "super-admin";
  const parsed = parseProfileFormData({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    role: allowRoleChange ? formData.get("role") : null,
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });
  if (!parsed.success) {
    return {
      ok: false as const,
      error: parsed.error.issues[0]?.message ?? "Invalid form",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const { confirmPassword: _confirm, ...fields } = parsed.data;
    const updated = await updateOwnProfile(actor.userId, fields, {
      allowRoleChange,
    });
    await applyAvatarUpload(context, actor.userId, formData);
    await writeAuditLog({
      actor,
      action: "user.profile_update",
      entityType: "user",
      entityId: actor.userId,
      summary: `Updated own profile (${updated.email})`,
      metadata: {
        email: updated.email,
        role: updated.role,
        roleChanged: allowRoleChange,
      },
      request,
    });
    return {
      ok: true as const,
      intent: "profile" as const,
      message: "Profile saved",
    };
  } catch (error) {
    return {
      ok: false as const,
      error: publicErrorMessage(error, {
        fallback: "Could not save profile",
        operation: "user_profile_update",
      }),
    };
  }
}

export default function ProfileRoute({ loaderData }: Route.ComponentProps) {
  const actionData = useActionData<typeof action>();
  useActionSuccessToast(actionData);

  return (
    <div>
      <PageHeader
        title="Profile"
        description="Manage your account details."
        breadcrumbs={[{ label: "Profile" }]}
      />
      <ProfileForm
        user={loaderData.user}
        canChangeRole={loaderData.canChangeRole}
        actionData={actionData}
      />
    </div>
  );
}
