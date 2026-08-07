import { useRef, useState } from "react";
import { useNavigation, useSubmit } from "react-router";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CameraIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { Select as NativeSelect } from "~/components/ui/form-controls";
import { UserAvatar } from "~/components/ui/user-avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import { useHandledActionData } from "~/hooks/use-handled-action-data";
import { formatRoleLabel } from "~/lib/auth/roles";
import type { AppUser } from "~/lib/db/types";
import { flattenFieldErrors, focusFormIssue } from "~/lib/form-validation-ui";
import {
  profileUpdateSchema,
  type ProfileUpdateFormValues,
} from "~/lib/zod/app-user";

type ProfileActionData =
  | { ok: true; intent: "profile"; message?: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export function ProfileForm({
  user,
  canChangeRole = false,
  actionData,
}: {
  user: AppUser;
  /** Admin (non–super-admin) may switch Broker / Admin on their own profile. */
  canChangeRole?: boolean;
  actionData?: ProfileActionData;
}) {
  const navigation = useNavigation();
  const submit = useSubmit();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const saving =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "profile";

  const formRole =
    user.role === "admin"
      ? "admin"
      : user.role === "broker"
        ? "broker"
        : "broker";

  const form = useForm<ProfileUpdateFormValues>({
    resolver: zodResolver(profileUpdateSchema),
    values: {
      fullName: user.fullName,
      email: user.email,
      role: formRole,
      password: "",
      confirmPassword: "",
    },
  });
  const watchedEmail = useWatch({ control: form.control, name: "email" });
  const watchedFullName = useWatch({ control: form.control, name: "fullName" });

  useHandledActionData(actionData, {
    intents: ["profile"],
    onSuccess: () => {
      setAvatarFile(null);
      setRemoveAvatar(false);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    },
  });

  function onPickAvatar(file: File | null) {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    setAvatarFile(file);
    if (file) setRemoveAvatar(false);
  }

  function onSubmit(values: ProfileUpdateFormValues) {
    const data = new FormData();
    data.set("intent", "profile");
    data.set("fullName", values.fullName);
    data.set("email", values.email);
    if (canChangeRole && values.role) data.set("role", values.role);
    if (values.password) data.set("password", values.password);
    if (values.confirmPassword) {
      data.set("confirmPassword", values.confirmPassword);
    }
    if (avatarFile) data.set("avatar", avatarFile);
    if (removeAvatar) data.set("removeAvatar", "1");
    submit(data, { method: "post", encType: "multipart/form-data" });
  }

  const showExistingAvatar =
    !previewUrl && !removeAvatar && Boolean(user.avatarR2Key);

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>Your profile</CardTitle>
        <CardDescription>
          Update your name, email, password, and photo
          {canChangeRole ? ", and role" : ""}.
          {!canChangeRole ? " Role changes require an admin account." : null}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          className="grid gap-4"
          onSubmit={form.handleSubmit(onSubmit, (errors) => {
            const first = flattenFieldErrors(errors)[0];
            if (first) focusFormIssue(form.setFocus, first.path);
          })}
          noValidate
        >
          <div className="flex flex-col gap-2">
            <div className="relative w-fit">
              <Tooltip>
                <TooltipTrigger
                  render={
                    <button
                      type="button"
                      className="group relative rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      aria-label="Change avatar"
                      onClick={() => fileInputRef.current?.click()}
                    />
                  }
                >
                  <UserAvatar
                    size="lg"
                    email={watchedEmail || user.email}
                    fullName={watchedFullName || user.fullName}
                    userId={showExistingAvatar ? user.userId : undefined}
                    avatarR2Key={showExistingAvatar ? user.avatarR2Key : null}
                    src={previewUrl}
                  />
                  <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                    <CameraIcon className="size-5" />
                  </span>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  className="max-w-[14rem] text-center"
                >
                  Click to upload a photo (JPEG, PNG, WebP, or GIF, max
                  2&nbsp;MB).
                </TooltipContent>
              </Tooltip>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={(event) => {
                  onPickAvatar(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </div>
            {previewUrl || showExistingAvatar ? (
              <button
                type="button"
                className="w-fit text-xs text-muted-foreground hover:text-foreground hover:underline"
                onClick={() => {
                  onPickAvatar(null);
                  if (user.avatarR2Key) setRemoveAvatar(true);
                }}
              >
                Remove photo
              </button>
            ) : null}
          </div>

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

          <Field data-invalid={form.formState.errors.email ? true : undefined}>
            <FieldLabel htmlFor="email">Work email</FieldLabel>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              aria-invalid={!!form.formState.errors.email}
              {...form.register("email")}
            />
            {form.formState.errors.email ? (
              <FieldError>{form.formState.errors.email.message}</FieldError>
            ) : null}
          </Field>

          {canChangeRole ? (
            <NativeSelect
              label="Role"
              error={form.formState.errors.role?.message}
              aria-invalid={!!form.formState.errors.role}
              {...form.register("role")}
            >
              <option value="broker">Broker</option>
              <option value="admin">Admin</option>
            </NativeSelect>
          ) : (
            <Field>
              <FieldLabel htmlFor="role-readonly">Role</FieldLabel>
              <Input
                id="role-readonly"
                value={formatRoleLabel(user.role)}
                disabled
                readOnly
              />
              {user.role === "super-admin" ? (
                <p className="text-xs text-muted-foreground">
                  Super-admin can only be set in the database.
                </p>
              ) : null}
            </Field>
          )}

          <Field
            data-invalid={form.formState.errors.password ? true : undefined}
          >
            <FieldLabel htmlFor="password">New password</FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!form.formState.errors.password}
              placeholder="Leave blank to keep current password"
              {...form.register("password")}
            />
            {form.formState.errors.password ? (
              <FieldError>{form.formState.errors.password.message}</FieldError>
            ) : null}
          </Field>

          <Field
            data-invalid={
              form.formState.errors.confirmPassword ? true : undefined
            }
          >
            <FieldLabel htmlFor="confirmPassword">Confirm password</FieldLabel>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!form.formState.errors.confirmPassword}
              placeholder="Confirm new password"
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword ? (
              <FieldError>
                {form.formState.errors.confirmPassword.message}
              </FieldError>
            ) : null}
          </Field>

          {actionData && !actionData.ok && actionData.error ? (
            <p className="text-sm text-destructive" role="alert">
              {actionData.error}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2">
            <LoadingButton
              type="submit"
              loading={saving}
              loadingLabel="Saving…"
            >
              Save profile
            </LoadingButton>
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() => {
                form.reset({
                  fullName: user.fullName,
                  email: user.email,
                  role: formRole,
                  password: "",
                  confirmPassword: "",
                });
                onPickAvatar(null);
                setRemoveAvatar(false);
              }}
            >
              Reset
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
