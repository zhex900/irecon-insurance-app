import { describe, expect, it } from "vitest";

import {
  initialTemplateEditorAutosaveState,
  templateEditorAutosaveReducer,
} from "~/lib/documents/template-editor-autosave";

describe("templateEditorAutosaveReducer", () => {
  it("marks dirty when template changes without touching autosave status", () => {
    const next = templateEditorAutosaveReducer(
      initialTemplateEditorAutosaveState,
      {
        type: "template_diff",
        changes: [{ kind: "changed", label: "Moved field" }],
        canRevert: true,
      },
    );
    expect(next.dirty).toBe(true);
    expect(next.autosaveStatus).toBe("idle");
    expect(next.canRevert).toBe(true);
  });

  it("leaves autosave status unchanged on autosave submit/success", () => {
    const saving = templateEditorAutosaveReducer(
      initialTemplateEditorAutosaveState,
      { type: "autosave_submit" },
    );
    const saved = templateEditorAutosaveReducer(saving, {
      type: "autosave_success",
    });
    expect(saved.autosaveStatus).toBe("idle");
  });

  it("returns to idle after saved indicator elapses", () => {
    const saved = {
      ...initialTemplateEditorAutosaveState,
      autosaveStatus: "saved" as const,
    };
    const next = templateEditorAutosaveReducer(saved, {
      type: "saved_indicator_elapsed",
    });
    expect(next.autosaveStatus).toBe("idle");
  });

  it("keeps pending status on save error when still dirty", () => {
    const dirty = templateEditorAutosaveReducer(
      initialTemplateEditorAutosaveState,
      {
        type: "template_diff",
        changes: [{ kind: "changed", label: "Resize" }],
        canRevert: true,
      },
    );
    const next = templateEditorAutosaveReducer(dirty, {
      type: "save_error",
      stillDirty: true,
    });
    expect(next.autosaveStatus).toBe("pending");
  });

  it("clears dirty state on publish success", () => {
    const dirty = {
      ...initialTemplateEditorAutosaveState,
      dirty: true,
      unsavedChanges: [{ kind: "changed", label: "Moved field" }],
      canRevert: true,
    };
    const next = templateEditorAutosaveReducer(dirty, {
      type: "publish_success",
    });
    expect(next.dirty).toBe(false);
    expect(next.canRevert).toBe(false);
    expect(next.autosaveStatus).toBe("idle");
  });
});
