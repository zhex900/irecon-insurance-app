import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "~/lib/db/client";
import { appUser } from "~/lib/db/schema";
import type { AppUser } from "~/lib/db/types";
import { normalizeAppUser } from "~/lib/services/users/normalize";

export { normalizeAppUser };

/** Public fields for note author display / hover card. */
export type NoteAuthor = Pick<
  AppUser,
  "userId" | "fullName" | "email" | "role" | "avatarR2Key"
>;

export async function listUsers(search?: string) {
  const db = getDb();
  const rows = await db.select().from(appUser).orderBy(asc(appUser.fullName));
  const sorted = rows.map(normalizeAppUser);
  if (!search?.trim()) return sorted;

  const q = search.toLowerCase();
  return sorted.filter((user) => {
    const haystack = [user.fullName, user.email, user.role]
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}

export async function getUser(userId: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(appUser)
    .where(eq(appUser.userId, userId))
    .limit(1);
  return row ? normalizeAppUser(row) : null;
}

export async function getUserByEmail(email: string) {
  const db = getDb();
  const [row] = await db
    .select()
    .from(appUser)
    .where(eq(appUser.email, email.trim().toLowerCase()))
    .limit(1);
  return row ? normalizeAppUser(row) : null;
}

/** Resolve note `createdBy` emails to user profiles (keyed by lowercase email). */
export async function resolveNoteAuthors(
  createdByValues: Array<string | null | undefined>,
): Promise<Record<string, NoteAuthor>> {
  const emails = [
    ...new Set(
      createdByValues
        .map((value) => value?.trim().toLowerCase() ?? "")
        .filter((value) => value.includes("@")),
    ),
  ];
  if (emails.length === 0) return {};

  const db = getDb();
  const rows = await db
    .select()
    .from(appUser)
    .where(inArray(appUser.email, emails));

  const authors: Record<string, NoteAuthor> = {};
  for (const row of rows) {
    const user = normalizeAppUser(row);
    authors[user.email.toLowerCase()] = {
      userId: user.userId,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      avatarR2Key: user.avatarR2Key,
    };
  }
  return authors;
}

export type AppUserWritable = Omit<
  AppUser,
  "userId" | "createdWhen" | "avatarR2Key"
> & {
  password?: string;
};

async function syncAuthBan(userId: string, disabled: boolean) {
  const { getSupabaseAdmin } = await import("~/lib/supabase/admin.server");
  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: disabled ? "876000h" : "none",
    app_metadata: { disabled },
  });
  if (error) throw new Error(error.message);
}

export async function createUser(input: AppUserWritable) {
  if (!input.password || input.password.length < 8) {
    throw new Error("Password is required (min 8 characters)");
  }

  const email = input.email.trim().toLowerCase();
  // super-admin is DB-only — UI create can only assign broker/admin.
  const role = input.role === "admin" ? "admin" : "broker";
  const authorisedRepresentativeId = input.authorisedRepresentativeId ?? null;

  const { getSupabaseAdmin } = await import("~/lib/supabase/admin.server");
  const admin = getSupabaseAdmin();
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: input.fullName.trim() },
    app_metadata: {
      role,
      authorised_representative_id: authorisedRepresentativeId,
      disabled: Boolean(input.disabled),
    },
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "Failed to create auth user");
  }

  if (input.disabled) {
    await syncAuthBan(data.user.id, true);
  }

  const db = getDb();
  try {
    const [created] = await db
      .insert(appUser)
      .values({
        userId: data.user.id,
        fullName: input.fullName.trim(),
        email,
        role,
        authorisedRepresentativeId,
        disabled: Boolean(input.disabled),
      })
      .returning();
    return normalizeAppUser(created);
  } catch (profileError) {
    await admin.auth.admin.deleteUser(data.user.id);
    throw profileError;
  }
}

export async function updateUser(userId: string, input: AppUserWritable) {
  const existing = await getUser(userId);
  if (!existing) throw new Error("User not found");

  const email = input.email.trim().toLowerCase();
  // Preserve super-admin; UI cannot assign or demote that role.
  const role =
    existing.role === "super-admin"
      ? "super-admin"
      : input.role === "admin"
        ? "admin"
        : "broker";
  const authorisedRepresentativeId = input.authorisedRepresentativeId ?? null;

  const { getSupabaseAdmin } = await import("~/lib/supabase/admin.server");
  const admin = getSupabaseAdmin();
  const authUpdate: {
    email: string;
    email_confirm: boolean;
    user_metadata: { full_name: string };
    app_metadata: {
      role: string;
      authorised_representative_id: number | null;
      disabled: boolean;
    };
    password?: string;
    ban_duration?: string;
  } = {
    email,
    email_confirm: true,
    user_metadata: { full_name: input.fullName.trim() },
    app_metadata: {
      role,
      authorised_representative_id: authorisedRepresentativeId,
      disabled: Boolean(input.disabled),
    },
    ban_duration: input.disabled ? "876000h" : "none",
  };
  if (input.password && input.password.length >= 8) {
    authUpdate.password = input.password;
  }

  const { error } = await admin.auth.admin.updateUserById(userId, authUpdate);
  if (error) throw new Error(error.message);

  const db = getDb();
  const [updated] = await db
    .update(appUser)
    .set({
      fullName: input.fullName.trim(),
      email,
      role,
      authorisedRepresentativeId,
      disabled: Boolean(input.disabled),
    })
    .where(eq(appUser.userId, userId))
    .returning();
  if (!updated) throw new Error("User not found");
  return normalizeAppUser(updated);
}

export async function setUserDisabled(userId: string, disabled: boolean) {
  const existing = await getUser(userId);
  if (!existing) throw new Error("User not found");
  await syncAuthBan(userId, disabled);
  const db = getDb();
  const [updated] = await db
    .update(appUser)
    .set({
      disabled,
    })
    .where(eq(appUser.userId, userId))
    .returning();
  if (!updated) throw new Error("User not found");
  return normalizeAppUser(updated);
}

export async function deleteUser(userId: string) {
  const existing = await getUser(userId);
  if (!existing) throw new Error("User not found");

  const { getSupabaseAdmin } = await import("~/lib/supabase/admin.server");
  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  // app_user row is removed via ON DELETE CASCADE from auth.users
}

export async function setUserAvatarKey(
  userId: string,
  avatarR2Key: string | null,
) {
  const db = getDb();
  const [updated] = await db
    .update(appUser)
    .set({ avatarR2Key })
    .where(eq(appUser.userId, userId))
    .returning();
  if (!updated) throw new Error("User not found");
  return normalizeAppUser(updated);
}
