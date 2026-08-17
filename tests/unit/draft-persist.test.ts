import type { UseFormReturn } from "react-hook-form";
import { describe, expect, it, vi } from "vitest";

import {
  applyOptimisticDraftSave,
  collectDraftDirtyPaths,
  completeLeaveAfterDraftSave,
  discardInFlightDraft,
  type DraftPersistRefs,
  type DraftPersistSetters,
  queueFollowUpDraftSave,
  queueInFlightDraftSave,
  reconcileDraftSaveSuccess,
  rollbackDraftSave,
  waitWhileDraftSaving,
} from "~/components/policies/wizard/hooks/draft/draft-persist";
import type { PolicyLeaveApi } from "~/components/policies/wizard/hooks/draft/use-draft-types";
import { SaveEpochTracker } from "~/components/policies/wizard/hooks/draft/use-draft-utils";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function box<T>(value: T): { current: T } {
  return { current: value };
}

function createRefs(
  overrides: Partial<{
    [K in keyof DraftPersistRefs]: DraftPersistRefs[K]["current"];
  }> = {},
): DraftPersistRefs {
  return {
    hasUnsavedChangesRef: box(overrides.hasUnsavedChangesRef ?? true),
    isSavingDraftRef: box(overrides.isSavingDraftRef ?? false),
    pendingSaveAfterCurrentRef: box(
      overrides.pendingSaveAfterCurrentRef ?? false,
    ),
    pendingSkipPremiumRefreshRef: box(
      overrides.pendingSkipPremiumRefreshRef ?? false,
    ),
    lastHandledSavedAtRef: box(overrides.lastHandledSavedAtRef ?? null),
    pendingDraftPayloadRef: box(overrides.pendingDraftPayloadRef ?? "saved"),
    pendingDirtyPathsRef: box(
      overrides.pendingDirtyPathsRef ?? ["policyNumber"],
    ),
    savedSnapshotRef: box(overrides.savedSnapshotRef ?? "saved"),
    previousSnapshotRef: box(overrides.previousSnapshotRef ?? ""),
    previousSavedAtRef: box(overrides.previousSavedAtRef ?? null),
    premiumManuallyEditedRef: box(overrides.premiumManuallyEditedRef ?? false),
    saveEpochTracker: box(overrides.saveEpochTracker ?? new SaveEpochTracker()),
  };
}

function createSetters() {
  return {
    setHasUnsavedChanges: vi.fn(),
    setDraftSavedAt: vi.fn(),
    setDraftSaveError: vi.fn(),
    commitSavedPaths: vi.fn(),
    rollbackSavedPaths: vi.fn(),
    publishSaveStatus: vi.fn(),
    refreshPremiumAfterSave: vi.fn(),
  } satisfies DraftPersistSetters;
}

function createForm() {
  return {
    trigger: vi.fn(),
    setError: vi.fn(),
    clearErrors: vi.fn(),
    getValues: vi.fn(() => ({})),
    formState: { dirtyFields: {} },
  } as unknown as UseFormReturn<CarPolicyFormValues>;
}

function createLeave(
  state: "blocked" | "unblocked" = "blocked",
): PolicyLeaveApi & {
  proceed: ReturnType<typeof vi.fn>;
  setPendingLeaveAfterSave: ReturnType<typeof vi.fn>;
  setDiscardConfirmOpen: ReturnType<typeof vi.fn>;
} {
  const proceed = vi.fn();
  const setPendingLeaveAfterSave = vi.fn();
  const setDiscardConfirmOpen = vi.fn();
  return {
    blocker: { state, proceed, reset: vi.fn() } as PolicyLeaveApi["blocker"],
    allowLeaveRef: box(false),
    pendingLeaveAfterSaveRef: box(true),
    pendingLeaveDestinationRef: box("/clients/from-blocker"),
    setPendingLeaveAfterSave,
    setDiscardConfirmOpen,
    proceed,
  };
}

describe("collectDraftDirtyPaths", () => {
  it("prefers highlight paths when present", () => {
    expect(
      collectDraftDirtyPaths(["coverTypeId"], { policyNumber: true }),
    ).toEqual(["coverTypeId"]);
  });

  it("falls back to flattened RHF dirty fields", () => {
    expect(
      collectDraftDirtyPaths([], { car: { estimatedTurnover: true } }),
    ).toEqual(["car.estimatedTurnover"]);
  });
});

describe("applyOptimisticDraftSave", () => {
  it("increments the epoch and clears unsaved state", () => {
    const refs = createRefs();
    const setters = createSetters();
    const form = createForm();
    const epoch = applyOptimisticDraftSave({
      refs,
      setters,
      form,
      payload: "next",
      pathsToValidate: ["policyNumber"],
    });

    expect(epoch).toBe(1);
    expect(refs.savedSnapshotRef.current).toBe("next");
    expect(refs.hasUnsavedChangesRef.current).toBe(false);
    expect(refs.isSavingDraftRef.current).toBe(true);
    expect(setters.publishSaveStatus).toHaveBeenCalledWith("saved");
    expect(setters.commitSavedPaths).toHaveBeenCalledWith(["policyNumber"]);
    expect(form.trigger).toHaveBeenCalled();
  });
});

describe("rollbackDraftSave", () => {
  it("restores the previous snapshot and clears pending leave", () => {
    const refs = createRefs({
      savedSnapshotRef: "optimistic",
      previousSnapshotRef: "prior",
      previousSavedAtRef: "2026-01-01T00:00:00.000Z",
    });
    const setters = createSetters();
    const leave = createLeave();
    const form = createForm();

    rollbackDraftSave({
      refs,
      setters,
      leave,
      form,
      formError: "Draft could not be saved.",
      policyNumberError: "Taken",
    });

    expect(refs.savedSnapshotRef.current).toBe("prior");
    expect(refs.hasUnsavedChangesRef.current).toBe(true);
    expect(setters.publishSaveStatus).toHaveBeenCalledWith("error");
    expect(setters.rollbackSavedPaths).toHaveBeenCalledWith(["policyNumber"]);
    expect(form.setError).toHaveBeenCalledWith("policyNumber", {
      type: "server",
      message: "Taken",
    });
    expect(leave.pendingLeaveAfterSaveRef.current).toBe(false);
    expect(leave.setPendingLeaveAfterSave).toHaveBeenCalledWith(false);
  });
});

describe("reconcileDraftSaveSuccess", () => {
  it("keeps the form dirty when values changed during the save", () => {
    const refs = createRefs({ pendingDraftPayloadRef: "saved" });
    const setters = createSetters();
    const editedDuringSave = reconcileDraftSaveSuccess({
      refs,
      setters,
      form: createForm(),
      draftSnapshot: () => "edited",
      skipPremiumRefresh: false,
      policyNumber: "P-1",
      savedAt: "2026-08-17T00:00:00.000Z",
      payload: "saved",
    });

    expect(editedDuringSave).toBe(true);
    expect(refs.hasUnsavedChangesRef.current).toBe(true);
    expect(refs.pendingSaveAfterCurrentRef.current).toBe(true);
    expect(setters.refreshPremiumAfterSave).toHaveBeenCalledWith([
      "policyNumber",
    ]);
  });

  it("clears dirty state when nothing changed during the save", () => {
    const refs = createRefs({ pendingDraftPayloadRef: "saved" });
    const setters = createSetters();
    const editedDuringSave = reconcileDraftSaveSuccess({
      refs,
      setters,
      form: createForm(),
      draftSnapshot: () => "saved",
      skipPremiumRefresh: true,
      policyNumber: "P-1",
      savedAt: "2026-08-17T00:00:00.000Z",
      payload: "saved",
    });

    expect(editedDuringSave).toBe(false);
    expect(refs.hasUnsavedChangesRef.current).toBe(false);
    expect(setters.publishSaveStatus).toHaveBeenCalledWith("saved");
    expect(setters.refreshPremiumAfterSave).not.toHaveBeenCalled();
  });

  it("skips server premium refresh after a manual Premium Breakdown edit", () => {
    const refs = createRefs({
      pendingDraftPayloadRef: "saved",
      premiumManuallyEditedRef: true,
    });
    const setters = createSetters();
    reconcileDraftSaveSuccess({
      refs,
      setters,
      form: createForm(),
      draftSnapshot: () => "saved",
      skipPremiumRefresh: false,
      policyNumber: "P-1",
      savedAt: "2026-08-17T00:00:00.000Z",
      payload: "saved",
    });

    expect(setters.refreshPremiumAfterSave).not.toHaveBeenCalled();
  });
});

describe("completeLeaveAfterDraftSave", () => {
  it("proceeds a blocked navigation after a clean save", () => {
    const leave = createLeave("blocked");
    completeLeaveAfterDraftSave({
      leave,
      editedDuringSave: false,
      clientId: "client-1",
      navigate: vi.fn(),
    });

    expect(leave.proceed).toHaveBeenCalled();
    expect(leave.allowLeaveRef.current).toBe(true);
    expect(leave.pendingLeaveDestinationRef.current).toBeNull();
  });

  it("navigates when the blocker is not active", () => {
    const leave = createLeave("unblocked");
    const navigate = vi.fn();
    completeLeaveAfterDraftSave({
      leave,
      editedDuringSave: false,
      clientId: "client-1",
      navigate,
    });

    expect(navigate).toHaveBeenCalledWith("/clients/from-blocker");
    expect(leave.proceed).not.toHaveBeenCalled();
  });

  it("does not leave when the form was edited during save", () => {
    const leave = createLeave("blocked");
    const navigate = vi.fn();
    completeLeaveAfterDraftSave({
      leave,
      editedDuringSave: true,
      clientId: "client-1",
      navigate,
    });

    expect(leave.proceed).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
    expect(leave.pendingLeaveAfterSaveRef.current).toBe(true);
  });
});

describe("queueInFlightDraftSave", () => {
  it("queues another save and remembers skipPremiumRefresh", () => {
    const pendingSaveAfterCurrentRef = box(false);
    const pendingSkipPremiumRefreshRef = box(false);
    queueInFlightDraftSave({
      pendingSaveAfterCurrentRef,
      pendingSkipPremiumRefreshRef,
      skipPremiumRefresh: true,
    });
    expect(pendingSaveAfterCurrentRef.current).toBe(true);
    expect(pendingSkipPremiumRefreshRef.current).toBe(true);
  });
});

describe("queueFollowUpDraftSave", () => {
  it("re-saves on a microtask when a save was queued during flight", async () => {
    const tracker = new SaveEpochTracker();
    const epoch = tracker.increment();
    const refs = createRefs({
      saveEpochTracker: tracker,
      pendingSaveAfterCurrentRef: true,
      pendingSkipPremiumRefreshRef: true,
      isSavingDraftRef: true,
    });
    const persistDraft = vi.fn().mockResolvedValue(true);

    queueFollowUpDraftSave({ epoch, refs, persistDraft });

    expect(refs.isSavingDraftRef.current).toBe(false);
    expect(refs.pendingSaveAfterCurrentRef.current).toBe(false);
    await Promise.resolve();
    expect(persistDraft).toHaveBeenCalledWith({
      force: true,
      skipPremiumRefresh: true,
    });
  });

  it("ignores a stale epoch", () => {
    const tracker = new SaveEpochTracker();
    tracker.increment();
    tracker.increment();
    const refs = createRefs({
      saveEpochTracker: tracker,
      pendingSaveAfterCurrentRef: true,
      isSavingDraftRef: true,
    });
    const persistDraft = vi.fn();

    queueFollowUpDraftSave({ epoch: 1, refs, persistDraft });

    expect(refs.isSavingDraftRef.current).toBe(false);
    expect(persistDraft).not.toHaveBeenCalled();
  });
});

describe("discardInFlightDraft", () => {
  it("invalidates the current epoch and drops a queued follow-up", () => {
    const tracker = new SaveEpochTracker();
    tracker.increment();
    const refs = createRefs({
      saveEpochTracker: tracker,
      pendingSaveAfterCurrentRef: true,
      pendingSkipPremiumRefreshRef: true,
    });

    discardInFlightDraft(refs);

    expect(tracker.current).toBe(2);
    expect(refs.pendingSaveAfterCurrentRef.current).toBe(false);
    expect(refs.pendingSkipPremiumRefreshRef.current).toBe(false);
  });
});

describe("waitWhileDraftSaving", () => {
  it("resolves immediately when no save is in flight", async () => {
    await waitWhileDraftSaving(box(false), 100, 10);
  });

  it("waits until the in-flight save clears", async () => {
    const isSavingDraftRef = box(true);
    setTimeout(() => {
      isSavingDraftRef.current = false;
    }, 30);
    await waitWhileDraftSaving(isSavingDraftRef, 500, 10);
    expect(isSavingDraftRef.current).toBe(false);
  });
});
