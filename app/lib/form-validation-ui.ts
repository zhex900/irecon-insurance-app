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

function findFocusableElement(path: string): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const selectors = [
    `[name="${CSS.escape(path)}"]`,
    `#${CSS.escape(path)}`,
    `[id="${CSS.escape(path)}"]`,
    `[aria-labelledby="${CSS.escape(path)}"]`,
    `label[for="${CSS.escape(path)}"]`,
  ];

  for (const selector of selectors) {
    try {
      const el = document.querySelector<HTMLElement>(selector);
      if (!el) continue;
      if (el.tagName === "LABEL") {
        const control = document.getElementById(
          (el as HTMLLabelElement).htmlFor,
        );
        if (control instanceof HTMLElement) return control;
        continue;
      }
      return el;
    } catch {
      // Invalid selector for this path — try the next.
    }
  }

  // AmountInput / InputGroup: match the inner control near a label.
  const label = document.querySelector(`label[for="${CSS.escape(path)}"]`);
  if (label) {
    const field = label.closest("[data-slot=field], .grid, div");
    const input = field?.querySelector<HTMLElement>(
      "input, select, textarea, button, [tabindex]",
    );
    if (input) return input;
  }

  return null;
}

/** Focus and scroll to the first invalid field (RHF setFocus + DOM fallback). */
export function focusFormIssue<TFieldValues extends FieldValues>(
  setFocus: UseFormSetFocus<TFieldValues>,
  path: string,
) {
  try {
    setFocus(path as never, { shouldSelect: true });
  } catch {
    // Checkbox / custom controls may not register a focusable ref.
  }

  const run = () => {
    const el = findFocusableElement(path);
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (document.activeElement !== el && typeof el.focus === "function") {
      el.focus({ preventScroll: true });
    }
    return true;
  };

  requestAnimationFrame(() => {
    if (run()) return;
    // Collapsible / conditional fields may appear one frame later.
    requestAnimationFrame(() => {
      run();
    });
  });
}
