import type {
  FieldErrors,
  FieldValues,
  UseFormSetFocus,
} from "react-hook-form";

export type FormIssue = { path: string; message: string };

/** Flatten nested RHF / Zod field errors into path + message pairs. */
export function flattenFieldErrors(
  errors: FieldErrors,
  prefix = "",
): FormIssue[] {
  const issues: FormIssue[] = [];

  for (const [key, value] of Object.entries(errors)) {
    if (!value || typeof value !== "object") continue;
    const path = prefix ? `${prefix}.${key}` : key;

    if ("message" in value && value.message != null && value.message !== "") {
      issues.push({ path, message: String(value.message) });
      continue;
    }

    issues.push(...flattenFieldErrors(value as FieldErrors, path));
  }

  return issues;
}

/** Prefer wizard field order so the first issue matches on-screen order. */
export function orderFormIssues(
  issues: FormIssue[],
  fieldOrder: string[],
): FormIssue[] {
  if (fieldOrder.length === 0) return issues;

  const inOrder = (path: string) =>
    fieldOrder.some((field) => path === field || path.startsWith(`${field}.`));

  return [...issues]
    .filter((issue) => inOrder(issue.path))
    .sort((a, b) => {
      const indexOf = (path: string) => {
        const exact = fieldOrder.indexOf(path);
        if (exact >= 0) return exact;
        return fieldOrder.findIndex(
          (field) => path === field || path.startsWith(`${field}.`),
        );
      };
      return indexOf(a.path) - indexOf(b.path);
    });
}

function scrollFocusedControl(path: string): boolean {
  if (typeof document === "undefined") return false;

  const active = document.activeElement;
  if (
    active instanceof HTMLElement &&
    active !== document.body &&
    (active.id === path || active.getAttribute("name") === path)
  ) {
    active.scrollIntoView({ behavior: "smooth", block: "center" });
    return true;
  }

  // id on the visible control (Select trigger / input) once mounted.
  const byId = document.getElementById(path);
  if (!(byId instanceof HTMLElement)) return false;
  if (byId instanceof HTMLInputElement && byId.type === "hidden") return false;
  byId.focus({ preventScroll: true });
  byId.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}

/**
 * Focus + scroll to a field via React Hook Form refs.
 * Controls should register a focusable element with `ref={field.ref}` /
 * `register()` so `setFocus` works — no DOM field scraping.
 * Retries briefly for collapsible / conditionally mounted fields.
 */
export function focusFormIssue<TFieldValues extends FieldValues>(
  setFocus: UseFormSetFocus<TFieldValues>,
  path: string,
) {
  let attempts = 0;
  const maxAttempts = 12;

  const tryFocus = () => {
    try {
      setFocus(path as never, { shouldSelect: true });
    } catch {
      // Control not registered yet (conditional mount) or non-focusable.
    }
    return scrollFocusedControl(path);
  };

  const schedule = () => {
    if (tryFocus()) return;
    attempts += 1;
    if (attempts >= maxAttempts) return;
    window.setTimeout(schedule, attempts <= 2 ? 16 : attempts * 80);
  };

  requestAnimationFrame(() => {
    requestAnimationFrame(schedule);
  });
}
