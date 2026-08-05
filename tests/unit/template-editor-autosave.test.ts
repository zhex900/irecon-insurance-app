import { describe, expect, it } from "vitest";
import {
  initialTemplateEditorAutosaveState,
  templateEditorAutosaveReducer,
} from "~/lib/documents/template-editor-autosave";

describe("templateEditorAutosaveReducer", () => {
  it("marks dirty and pending when template changes", () => {
    const next = templateEditorAutosaveReducer(
      initialTemplateEditorAutosaveState,
      {
        type: "template_diff",
        changes: [{ kind: "changed", label: "Moved field" }],
        canRevert: true,
      },
    );
    expect(next.dirty).toBe(true);
    expect(next.autosaveStatus).toBe("pending");
    expect(next.canRevert).toBe(true);
  });

  it("clears dirty state after autosave success", () => {
    const saving = templateEditorAutosaveReducer(
      initialTemplateEditorAutosaveState,
      { type: "autosave_submit" },
    );
    const saved = templateEditorAutosaveReducer(saving, {
      type: "autosave_success",
    });
    expect(saved.autosaveStatus).toBe("saved");
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
});
