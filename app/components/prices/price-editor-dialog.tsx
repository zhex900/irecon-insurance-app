import { Form, useNavigation } from "react-router";
import { XIcon } from "lucide-react";
import { Field, FieldLabel } from "~/components/ui/field";
import { LoadingButton } from "~/components/ui/loading-button";
import { Textarea } from "~/components/ui/textarea";

export function PriceEditorDialog({
  title,
  description,
  closeHref,
  intent,
  catalogue,
  id,
  json,
  error,
}: {
  title: string;
  description: string;
  closeHref: string;
  intent: "create" | "update";
  catalogue: string;
  id?: number;
  json: string;
  error?: string | null;
}) {
  const navigation = useNavigation();
  const saving =
    navigation.state === "submitting" &&
    (navigation.formData?.get("intent") === "create" ||
      navigation.formData?.get("intent") === "update");

  return (
    <div
      className="fixed inset-x-0 top-14 bottom-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-editor-title"
    >
      <div className="my-auto w-full max-w-3xl rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <h2
              id="price-editor-title"
              className="font-heading text-base leading-none font-medium"
            >
              {title}
            </h2>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
          <a
            href={closeHref}
            aria-label="Close"
            className="inline-flex size-7 items-center justify-center rounded-lg hover:bg-muted"
          >
            <XIcon className="size-4" />
          </a>
        </div>

        {error ? (
          <p className="mb-4 text-sm text-destructive">{error}</p>
        ) : null}

        <form method="post" className="flex flex-col gap-4">
          <input type="hidden" name="intent" value={intent} />
          <input type="hidden" name="catalogue" value={catalogue} />
          {id != null ? <input type="hidden" name="id" value={id} /> : null}
          <Field>
            <FieldLabel htmlFor="price-payload">
              Schedule payload (JSON)
            </FieldLabel>
            <Textarea
              id="price-payload"
              name="payload"
              rows={18}
              className="font-mono text-xs"
              defaultValue={json}
              required
            />
          </Field>
          <div className="flex flex-wrap justify-end gap-2">
            <a
              href={closeHref}
              className="inline-flex h-8 items-center justify-center rounded-lg border border-foreground/25 bg-background px-2.5 text-sm font-medium hover:bg-muted"
            >
              Cancel
            </a>
            <LoadingButton
              type="submit"
              loading={saving}
              loadingLabel={intent === "create" ? "Creating…" : "Saving…"}
            >
              {intent === "create" ? "Create" : "Save"}
            </LoadingButton>
          </div>
        </form>
      </div>
    </div>
  );
}

export function PriceDeleteDialog({
  label,
  closeHref,
  catalogue,
  id,
  error,
}: {
  label: string;
  closeHref: string;
  catalogue: string;
  id: number;
  error?: string | null;
}) {
  const navigation = useNavigation();
  const deleting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "delete";

  return (
    <div
      className="fixed inset-x-0 top-14 bottom-0 z-50 flex items-center justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="price-delete-title"
    >
      <div className="w-full max-w-md rounded-xl bg-popover p-4 text-sm text-popover-foreground shadow-lg ring-1 ring-foreground/10">
        <h2
          id="price-delete-title"
          className="font-heading text-base leading-none font-medium"
        >
          Delete schedule?
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          This permanently removes{" "}
          <span className="font-medium text-foreground">{label}</span>. This
          cannot be undone.
        </p>
        {error ? (
          <p className="mt-3 text-sm text-destructive">{error}</p>
        ) : null}
        <Form method="post" className="mt-4 flex flex-wrap justify-end gap-2">
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="catalogue" value={catalogue} />
          <input type="hidden" name="id" value={id} />
          <a
            href={closeHref}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-foreground/25 bg-background px-2.5 text-sm font-medium hover:bg-muted"
          >
            Cancel
          </a>
          <LoadingButton
            type="submit"
            variant="destructive"
            loading={deleting}
            loadingLabel="Deleting…"
          >
            Delete
          </LoadingButton>
        </Form>
      </div>
    </div>
  );
}
