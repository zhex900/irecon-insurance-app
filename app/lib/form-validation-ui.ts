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

const VISIBLE_CONTROL_SELECTOR =
  'button[data-slot=select-trigger], input:not([type="hidden"]), select, textarea, button:not([type="hidden"])';

function isHiddenInput(el: HTMLElement): boolean {
  return el instanceof HTMLInputElement && el.type === "hidden";
}

function visibleControlInField(fieldRoot: ParentNode): HTMLElement | null {
  return fieldRoot.querySelector<HTMLElement>(VISIBLE_CONTROL_SELECTOR);
}

function findFocusableElement(path: string): HTMLElement | null {
  if (typeof document === "undefined") return null;

  const byDataPath = document.querySelector<HTMLElement>(
    `[data-field-path="${CSS.escape(path)}"]`,
  );
  if (byDataPath) {
    if (byDataPath.matches(VISIBLE_CONTROL_SELECTOR)) return byDataPath;
    const nested = visibleControlInField(byDataPath);
    if (nested) return nested;
  }

  const label = document.querySelector<HTMLLabelElement>(
    `label[for="${CSS.escape(path)}"]`,
  );
  if (label) {
    const field = label.closest("[data-slot=field]");
    if (field) {
      const control = visibleControlInField(field);
      if (control) return control;
    }
    const byId = document.getElementById(label.htmlFor);
    if (byId instanceof HTMLElement && !isHiddenInput(byId)) return byId;
  }

  const byId = document.getElementById(path);
  if (byId instanceof HTMLElement && !isHiddenInput(byId)) return byId;

  const named = document.querySelector<HTMLElement>(
    `[name="${CSS.escape(path)}"]`,
  );
  if (named) {
    if (isHiddenInput(named)) {
      const field = named.closest("[data-slot=field]");
      if (field) {
        const control = visibleControlInField(field);
        if (control) return control;
      }
    } else {
      return named;
    }
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

  let attempts = 0;
  const maxAttempts = 8;

  const tryFocus = () => {
    const el = findFocusableElement(path);
    if (!el) return false;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    if (document.activeElement !== el && typeof el.focus === "function") {
      el.focus({ preventScroll: true });
    }
    return true;
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
