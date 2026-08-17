import { Form, useNavigation } from "react-router";

import { FeesBody } from "~/components/prices/bodies/fees";
import {
  CarBody,
  EslBody,
  PlantBody,
  StampBody,
} from "~/components/prices/bodies/primary";
import { TerrorBody } from "~/components/prices/bodies/terror";
import {
  DialogShell,
  FooterButton,
  MetaRow,
  type ScheduleView,
} from "~/components/prices/shared/dialog-shell";
import { LoadingButton } from "~/components/ui/loading-button";
import type { PriceCatalogueKind } from "~/lib/services/price/types";

export function Schedule({
  title,
  closeHref,
  editHref,
  onClose,
  onEdit,
  schedule,
  editing,
  canEdit,
  catalogue,
  id,
  error,
  formAction,
}: {
  title: string;
  closeHref?: string;
  editHref?: string;
  onClose?: () => void;
  onEdit?: () => void;
  schedule: ScheduleView;
  editing: boolean;
  canEdit: boolean;
  catalogue: PriceCatalogueKind;
  id: number;
  error?: string | null;
  /** Where update posts (defaults to current route). */
  formAction?: string;
}) {
  const navigation = useNavigation();
  const saving =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "update";

  const footer = editing ? (
    <>
      <FooterButton href={closeHref} onClick={onClose}>
        Cancel
      </FooterButton>
      <LoadingButton type="submit" form="price-schedule-form" loading={saving}>
        Save
      </LoadingButton>
    </>
  ) : (
    <>
      <FooterButton href={closeHref} onClick={onClose}>
        Close
      </FooterButton>
      {canEdit ? (
        <FooterButton href={editHref} onClick={onEdit} variant="default">
          Edit
        </FooterButton>
      ) : null}
    </>
  );

  return (
    <DialogShell
      title={title}
      closeHref={closeHref}
      onClose={onClose}
      error={error}
      footer={footer}
    >
      {editing ? (
        <Form
          id="price-schedule-form"
          method="post"
          action={formAction}
          className="flex flex-col gap-4"
        >
          <input type="hidden" name="intent" value="update" />
          <input type="hidden" name="catalogue" value={catalogue} />
          <input type="hidden" name="id" value={id} />
          <MetaRow
            dateStart={schedule.dateStart}
            published={schedule.published}
            createdBy={"createdBy" in schedule ? schedule.createdBy : undefined}
            editing
          />
          <ScheduleBody schedule={schedule} editing />
        </Form>
      ) : (
        <div className="flex flex-col gap-4">
          <MetaRow
            dateStart={schedule.dateStart}
            published={schedule.published}
            createdBy={"createdBy" in schedule ? schedule.createdBy : undefined}
            editing={false}
          />
          <ScheduleBody schedule={schedule} editing={false} />
        </div>
      )}
    </DialogShell>
  );
}

function ScheduleBody({
  schedule,
  editing,
}: {
  schedule: ScheduleView;
  editing: boolean;
}) {
  switch (schedule.kind) {
    case "car":
      return <CarBody schedule={schedule} editing={editing} />;
    case "stamp":
      return <StampBody schedule={schedule} editing={editing} />;
    case "esl":
      return <EslBody schedule={schedule} editing={editing} />;
    case "plant":
      return <PlantBody schedule={schedule} editing={editing} />;
    case "terror":
      return <TerrorBody schedule={schedule} editing={editing} />;
    case "fees":
      return <FeesBody schedule={schedule} editing={editing} />;
  }
}
export function DeleteDialog({
  label,
  closeHref,
  onClose,
  catalogue,
  id,
  error,
  formAction,
}: {
  label: string;
  closeHref?: string;
  onClose?: () => void;
  catalogue: string;
  id: number;
  error?: string | null;
  formAction?: string;
}) {
  const navigation = useNavigation();
  const deleting =
    navigation.state === "submitting" &&
    navigation.formData?.get("intent") === "delete";

  return (
    <DialogShell
      title="Delete schedule?"
      description={`This permanently removes ${label}. This cannot be undone.`}
      closeHref={closeHref}
      onClose={onClose}
      error={error}
      footer={
        <>
          <FooterButton href={closeHref} onClick={onClose}>
            Cancel
          </FooterButton>
          <Form method="post" action={formAction}>
            <input type="hidden" name="intent" value="delete" />
            <input type="hidden" name="catalogue" value={catalogue} />
            <input type="hidden" name="id" value={id} />
            <LoadingButton
              type="submit"
              variant="destructive"
              loading={deleting}
            >
              Delete
            </LoadingButton>
          </Form>
        </>
      }
    >
      {null}
    </DialogShell>
  );
}
