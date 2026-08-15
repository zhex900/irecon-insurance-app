import { Form, useNavigate, useNavigation } from "react-router";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { Button } from "~/components/ui/button";
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
  const navigate = useNavigate();
  const navigation = useNavigation();
  const saving =
    navigation.state === "submitting" &&
    (navigation.formData?.get("intent") === "create" ||
      navigation.formData?.get("intent") === "update");

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) void navigate(closeHref);
      }}
    >
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <Form method="post" className="flex flex-col gap-4">
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
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => void navigate(closeHref)}
            >
              Cancel
            </Button>
            <LoadingButton type="submit" loading={saving}>
              {intent === "create" ? "Create" : "Save"}
            </LoadingButton>
          </DialogFooter>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
