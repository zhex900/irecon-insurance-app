import {
  ArrowLeftIcon,
  EyeIcon,
  FilePlusIcon,
  HistoryIcon,
  RectangleHorizontalIcon,
  RectangleVerticalIcon,
  RotateCcwIcon,
  SaveIcon,
  Trash2Icon,
  Undo2Icon,
  UploadIcon,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { LoadingButton } from "~/components/ui/loading-button";
import {
  NativeSelect,
  NativeSelectOption,
} from "~/components/ui/native-select";
import { DOCUMENT_LABEL_MAX_LENGTH } from "~/lib/documents/document-label";
import type { DocumentPageOrientation } from "~/lib/pdf/templates";

type EditorToolbarProps = {
  editable: boolean;
  deletable: boolean;
  busy: boolean;
  previewLoading: boolean;
  canUndo: boolean;
  canRevert: boolean;
  intent: string;
  templateKey: string;
  savedLabel: string;
  label: string;
  coverType: string;
  orientation: DocumentPageOrientation;
  onLabelChange: (value: string) => void;
  onSaveLabel: (value: string) => void;
  onCoverTypeChange: (value: string) => void;
  onBack: () => void;
  onPreview: () => void;
  onAddPage: () => void;
  onOrientationChange: (value: DocumentPageOrientation) => void;
  onHistory: () => void;
  onUndo: () => void;
  onDelete: () => void;
  onRevert: () => void;
  onSaveDraft: () => void;
  onPublish: () => void;
};

export function DocumentTemplateEditorToolbar(props: EditorToolbarProps) {
  const disabled = props.busy || props.previewLoading;
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
      {props.editable ? (
        <>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            Label
            <Input
              value={props.label}
              maxLength={DOCUMENT_LABEL_MAX_LENGTH}
              aria-label="Document label"
              disabled={disabled}
              className="h-8 w-44 text-sm"
              onChange={(event) => props.onLabelChange(event.target.value)}
              onBlur={() => props.onSaveLabel(props.label.trim())}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  event.currentTarget.blur();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  props.onLabelChange(props.savedLabel);
                }
              }}
            />
          </label>
          <NativeSelect
            size="sm"
            aria-label="Cover type"
            value={props.coverType}
            disabled={disabled}
            onChange={(event) => props.onCoverTypeChange(event.target.value)}
            className="min-w-36"
          >
            <NativeSelectOption value="1">Annual</NativeSelectOption>
            <NativeSelectOption value="2">Single</NativeSelectOption>
            <NativeSelectOption value="3">Owner Builder</NativeSelectOption>
            <NativeSelectOption value="all">
              {props.templateKey === "adjustment"
                ? "Adjustment only"
                : "All cover types"}
            </NativeSelectOption>
          </NativeSelect>
        </>
      ) : (
        <span
          className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
          title="Document label"
        >
          {props.label || "—"}
        </span>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={props.onBack}
      >
        <ArrowLeftIcon data-icon="inline-start" /> Back
      </Button>
      <LoadingButton
        type="button"
        variant="outline"
        size="sm"
        loading={props.previewLoading}
        loadingLabel="Preview…"
        disabled={props.busy}
        onClick={props.onPreview}
      >
        <EyeIcon data-icon="inline-start" /> Preview
      </LoadingButton>
      {props.editable ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled}
          onClick={props.onAddPage}
          title="Add a blank page after the current page"
        >
          <FilePlusIcon data-icon="inline-start" /> Add page
        </Button>
      ) : null}
      {props.editable ? (
        <div className="flex items-center gap-1">
          {(["portrait", "landscape"] as const).map((value) => {
            const Icon =
              value === "portrait"
                ? RectangleVerticalIcon
                : RectangleHorizontalIcon;
            return (
              <Button
                key={value}
                type="button"
                variant={props.orientation === value ? "secondary" : "outline"}
                size="sm"
                disabled={disabled || props.orientation === value}
                onClick={() => props.onOrientationChange(value)}
                title={`${value === "portrait" ? "Portrait" : "Landscape"} A4 page`}
              >
                <Icon data-icon="inline-start" />{" "}
                {value === "portrait" ? "Portrait" : "Landscape"}
              </Button>
            );
          })}
        </div>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={props.onHistory}
      >
        <HistoryIcon data-icon="inline-start" /> History
      </Button>
      {props.editable ? (
        <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !props.canUndo}
            onClick={props.onUndo}
          >
            <Undo2Icon data-icon="inline-start" /> Undo publish
          </Button>
          {props.deletable ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={props.onDelete}
            >
              <Trash2Icon data-icon="inline-start" /> Delete
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || !props.canRevert}
            onClick={props.onRevert}
            title="Revert layout to the last manual checkpoint"
          >
            <RotateCcwIcon data-icon="inline-start" /> Revert
          </Button>
          <LoadingButton
            type="button"
            variant="outline"
            size="sm"
            loading={
              props.busy &&
              (props.intent === "draft" || props.intent === "autosave")
            }
            loadingLabel="Saving…"
            disabled={disabled}
            onClick={props.onSaveDraft}
          >
            <SaveIcon data-icon="inline-start" /> Save draft
          </LoadingButton>
          <LoadingButton
            type="button"
            size="sm"
            loading={props.busy && props.intent === "publish"}
            loadingLabel="Publishing…"
            disabled={disabled}
            onClick={props.onPublish}
          >
            <UploadIcon data-icon="inline-start" /> Publish
          </LoadingButton>
        </>
      ) : null}
    </div>
  );
}
