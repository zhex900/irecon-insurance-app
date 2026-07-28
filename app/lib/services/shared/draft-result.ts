/** Shared result shape for client/policy draft save API responses. */
export type DraftSaveResult =
  | { ok: true; savedAt: string }
  | {
      ok: false;
      formError?: string;
      errors?: Record<string, string[] | undefined>;
    };

export type DraftDiscardResult =
  { ok: true } | { ok: false; formError?: string };
