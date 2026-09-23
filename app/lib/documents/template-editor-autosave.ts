import type { Template } from "@pdfme/common";

import {
  diffUnsavedTemplate,
  type TemplateChange,
} from "~/lib/pdf/template-changelog";

export type AutosaveStatus = "idle" | "pending" | "saving" | "saved";

export type TemplateEditorAutosaveState = {
  dirty: boolean;
  unsavedChanges: TemplateChange[];
  canRevert: boolean;
  autosaveStatus: AutosaveStatus;
  pendingLeaveAfterSave: boolean;
};

export const initialTemplateEditorAutosaveState: TemplateEditorAutosaveState = {
  dirty: false,
  unsavedChanges: [],
  canRevert: false,
  autosaveStatus: "idle",
  pendingLeaveAfterSave: false,
};

export type TemplateEditorAutosaveAction =
  | {
      type: "template_diff";
      changes: TemplateChange[];
      canRevert: boolean;
    }
  | { type: "baseline_seeded" }
  | { type: "schedule_autosave" }
  | { type: "clear_autosave_timer" }
  | { type: "autosave_submit" }
  | { type: "autosave_success" }
  | { type: "draft_success" }
  | { type: "publish_success" }
  | { type: "save_error"; stillDirty: boolean }
  | { type: "reverted" }
  | { type: "request_leave_after_save" }
  | { type: "leave_after_save_complete" }
  | { type: "cancel_leave" }
  | { type: "discard_leave" }
  | { type: "saved_indicator_elapsed" };

export function templateEditorAutosaveReducer(
  state: TemplateEditorAutosaveState,
  action: TemplateEditorAutosaveAction,
): TemplateEditorAutosaveState {
  switch (action.type) {
    case "template_diff": {
      const dirty = action.changes.length > 0;
      return {
        ...state,
        dirty,
        unsavedChanges: action.changes,
        canRevert: action.canRevert,
      };
    }
    case "baseline_seeded":
      return {
        ...state,
        dirty: false,
        unsavedChanges: [],
        canRevert: false,
        autosaveStatus: "idle",
      };
    case "schedule_autosave":
    case "clear_autosave_timer":
    case "autosave_submit":
    case "autosave_success":
      return state;
    case "draft_success":
      return {
        ...state,
        autosaveStatus: "idle",
        pendingLeaveAfterSave: false,
      };
    case "publish_success":
      return {
        ...state,
        dirty: false,
        unsavedChanges: [],
        canRevert: false,
        autosaveStatus: "idle",
      };
    case "save_error":
      return {
        ...state,
        autosaveStatus: action.stillDirty ? "pending" : "idle",
      };
    case "reverted":
      return {
        ...state,
        dirty: false,
        unsavedChanges: [],
        canRevert: false,
        autosaveStatus: "idle",
      };
    case "request_leave_after_save":
      return {
        ...state,
        pendingLeaveAfterSave: true,
      };
    case "leave_after_save_complete":
      return {
        ...state,
        dirty: false,
        unsavedChanges: [],
        pendingLeaveAfterSave: false,
        autosaveStatus: "idle",
      };
    case "cancel_leave":
      return {
        ...state,
        pendingLeaveAfterSave: false,
      };
    case "discard_leave":
      return {
        ...state,
        dirty: false,
        unsavedChanges: [],
        pendingLeaveAfterSave: false,
        autosaveStatus: "idle",
      };
    case "saved_indicator_elapsed":
      return {
        ...state,
        autosaveStatus:
          state.autosaveStatus === "saved" ? "idle" : state.autosaveStatus,
      };
    default:
      return state;
  }
}

export function diffDirtyState(
  baseline: Template | null,
  current: Template | null,
  revertCheckpoint: Template | null,
) {
  if (!baseline || !current) {
    return {
      changes: [] as TemplateChange[],
      dirty: false,
      canRevert: false,
    };
  }
  const changes = diffUnsavedTemplate(baseline, current);
  const canRevert = revertCheckpoint
    ? diffUnsavedTemplate(revertCheckpoint, current).length > 0
    : false;
  return {
    changes,
    dirty: changes.length > 0,
    canRevert,
  };
}
