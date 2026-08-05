import { useEffect, useRef, useState } from "react";
import { useActionData, useNavigation, useSubmit } from "react-router";
import { useHandledActionData } from "~/hooks/use-handled-action-data";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CameraIcon } from "lucide-react";
import { Button } from "~/components/ui/button";
import { LoadingButton } from "~/components/ui/loading-button";
import { Checkbox } from "~/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Select as NativeSelect } from "~/components/ui/form-controls";
import { Input } from "~/components/ui/input";
import { UserAvatar } from "~/components/ui/user-avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "~/components/ui/tooltip";
import type { AppUser } from "~/lib/db/types";
import { flattenFieldErrors, focusFormIssue } from "~/lib/form-validation-ui";
import {
  appUserCreateSchema,
  appUserSchema,
  type AppUserFormValues,
} from "~/lib/zod/app-user";

type UserFormActionData =
  | { ok: true; intent: string; message?: string }
  | {
      ok: false;
      error: string;
      fieldErrors?: Record<string, string[] | undefined>;
    };

export function UserFormDialog({
  open,
  onOpenChange,
  editing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing: AppUser | null;
}) {
  const navigation = useNavigation();
  const actionData = useActionData() as UserFormActionData | undefined;
  const submit = useSubmit();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const saving =
    navigation.state === "submitting" &&
    (navigation.formData?.get("intent") === "create" ||
      navigation.formData?.get("intent") === "update");

  const isEditingSuperAdmin = editing?.role === "super-admin";

  const form = useForm<AppUserFormValues>({
    resolver: zodResolver(editing ? appUserSchema : appUserCreateSchema),
    values: {
      fullName: editing?.fullName ?? "",
      email: editing?.email ?? "",
      // super-admin is not assignable in UI; preserved server-side on update.
      role:
        editing?.role === "admin"
          ? "admin"
          : editing?.role === "broker"
            ? "broker"
            : "broker",
      disabled: editing?.disabled ?? false,
      password: "",
      confirmPassword: "",
    },
  });
  const watchedEmail = useWatch({ control: form.control, name: "email" });
  const watchedFullName = useWatch({ control: form.control, name: "fullName" });
  const watchedDisabled = useWatch({ control: form.control, name: "disabled" });

  const wasOpenRef = useRef(open);
  useEffect(() => {
    const justClosed = !open && wasOpenRef.current;
    wasOpenRef.current = open;
    if (justClosed) {
      setAvatarFile(null);
      setRemoveAvatar(false);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
    }
  }, [open]);

  useHandledActionData(actionData, {
    enabled: open,
    intents: ["create", "update"],
    onSuccess: () => onOpenChange(false),
  });

  function onPickAvatar(file: File | null) {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : null;
    });
    setAvatarFile(file);
    if (file) setRemoveAvatar(false);
  }

  function onSubmit(values: AppUserFormValues) {
    const data = new FormData();
    data.set("intent", editing ? "update" : "create");
    if (editing) data.set("id", editing.userId);
    data.set("fullName", values.fullName);
    data.set("email", values.email);
    data.set("role", values.role);
    if (values.disabled) data.set("disabled", "true");
    if (values.password) data.set("password", values.password);
    if (values.confirmPassword) {
      data.set("confirmPassword", values.confirmPassword);
    }
    if (avatarFile) data.set("avatar", avatarFile);
    if (removeAvatar) data.set("removeAvatar", "1");
    submit(data, { method: "post", encType: "multipart/form-data" });
  }

  const showExistingAvatar =
    !previewUrl && !removeAvatar && Boolean(editing?.avatarR2Key);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg" showCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="relative shrink-0">
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
                    email={watchedEmail || editing?.email || ""}
                    fullName={watchedFullName || editing?.fullName || "?"}
                    userId={showExistingAvatar ? editing?.userId : undefined}
                    avatarR2Key={
                      showExistingAvatar ? editing?.avatarR2Key : null
                    }
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
            <span>{editing ? "Edit user" : "Add user"}</span>
          </DialogTitle>

          {previewUrl || showExistingAvatar ? (
            <button
              type="button"
              className="w-fit text-xs text-muted-foreground hover:text-foreground hover:underline"
              onClick={() => {
                onPickAvatar(null);
                if (editing?.avatarR2Key) setRemoveAvatar(true);
              }}
            >
              Remove photo
            </button>
          ) : null}
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

          <Field
            data-invalid={form.formState.errors.password ? true : undefined}
          >
            <FieldLabel htmlFor="password">
              {editing ? "New password" : "Password"}
            </FieldLabel>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              aria-invalid={!!form.formState.errors.password}
              placeholder={
                editing
                  ? "Leave blank to keep current password"
                  : "Min 8 characters"
              }
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
              placeholder={
                editing ? "Confirm new password" : "Re-enter password"
              }
              {...form.register("confirmPassword")}
            />
            {form.formState.errors.confirmPassword ? (
              <FieldError>
                {form.formState.errors.confirmPassword.message}
              </FieldError>
            ) : null}
          </Field>

          {isEditingSuperAdmin ? (
            <Field>
              <FieldLabel htmlFor="role-readonly">Role</FieldLabel>
              <Input id="role-readonly" value="Super admin" disabled readOnly />
              <p className="text-xs text-muted-foreground">
                Super-admin can only be set in the database.
              </p>
            </Field>
          ) : (
            <NativeSelect
              label="Role"
              error={form.formState.errors.role?.message}
              aria-invalid={!!form.formState.errors.role}
              {...form.register("role")}
            >
              <option value="broker">Broker</option>
              <option value="admin">Admin</option>
            </NativeSelect>
          )}

          <Field orientation="horizontal" className="items-center gap-2">
            <Checkbox
              id="disabled"
              checked={watchedDisabled}
              onCheckedChange={(checked) =>
                form.setValue("disabled", checked === true, {
                  shouldDirty: true,
                })
              }
            />
            <FieldLabel htmlFor="disabled" className="font-normal">
              Disabled (cannot sign in)
            </FieldLabel>
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
