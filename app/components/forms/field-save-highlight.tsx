import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckIcon } from "lucide-react";
import { useFormContext } from "react-hook-form";
import { cn } from "~/lib/utils";

const JUST_SAVED_MS = 2500;
/** Keep Taken-gate / nav attention visible long enough to find the field. */
const ATTENTION_MS = 12_000;

type SaveHighlightContextValue = {
  isJustSaved: (name: string | undefined) => boolean;
  isDirtyPath: (name: string | undefined) => boolean;
  isAttentionPath: (name: string | undefined) => boolean;
  getDirtyPaths: () => string[];
  /** Optimistic: green flash + clear amber immediately. */
  commitSavedPaths: (paths: string[]) => void;
  /** Roll back optimistic commit if the network save fails. */
  rollbackSavedPaths: (paths: string[]) => void;
  noteDirtyPath: (name: string | undefined) => void;
  /** Yellow border focus cue (e.g. side-nav incomplete counter). */
  markAttentionPath: (name: string | undefined) => void;
  /** Yellow border for multiple fields at once (section invalid counter). */
  markAttentionPaths: (paths: string[]) => void;
};

const SaveHighlightContext = createContext<SaveHighlightContextValue>({
  isJustSaved: () => false,
  isDirtyPath: () => false,
  isAttentionPath: () => false,
  getDirtyPaths: () => [],
  commitSavedPaths: () => {},
  rollbackSavedPaths: () => {},
  noteDirtyPath: () => {},
  markAttentionPath: () => {},
  markAttentionPaths: () => {},
});

/** Flatten RHF dirtyFields into dot-paths like "excesses.excessPlantEquipment". */
export function flattenDirtyPaths(dirty: unknown, prefix = ""): string[] {
  if (dirty === true) return prefix ? [prefix] : [];
  if (!dirty || typeof dirty !== "object") return [];
  return Object.entries(dirty as Record<string, unknown>).flatMap(
    ([key, value]) => {
      const path = prefix ? `${prefix}.${key}` : key;
      if (value === true) return [path];
      return flattenDirtyPaths(value, path);
    },
  );
}

function pathMatches(paths: Set<string>, name: string) {
  if (paths.has(name)) return true;
  for (const path of paths) {
    if (name.startsWith(`${path}.`) || path.startsWith(`${name}.`)) {
      return true;
    }
  }
  return false;
}

export function JustSavedProvider({ children }: { children: ReactNode }) {
  const form = useFormContext();
  const [justSavedPaths, setJustSavedPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const [dirtyPaths, setDirtyPaths] = useState<Set<string>>(() => new Set());
  const [attentionPaths, setAttentionPaths] = useState<Set<string>>(
    () => new Set(),
  );
  const dirtyPathsRef = useRef(dirtyPaths);
  useEffect(() => {
    dirtyPathsRef.current = dirtyPaths;
  });
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attentionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const subscription = form.watch((_values, info) => {
      const name = info.name;
      if (!name) return;
      setDirtyPaths((prev) => {
        if (prev.has(name)) return prev;
        const next = new Set(prev);
        next.add(name);
        return next;
      });
    });
    return () => subscription.unsubscribe();
  }, [form]);

  const commitSavedPaths = useCallback((paths: string[]) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setJustSavedPaths(new Set(paths));
    setDirtyPaths(new Set());
    timerRef.current = setTimeout(() => {
      setJustSavedPaths(new Set());
      timerRef.current = null;
    }, JUST_SAVED_MS);
  }, []);

  const rollbackSavedPaths = useCallback((paths: string[]) => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setJustSavedPaths(new Set());
    setDirtyPaths((prev) => {
      const next = new Set(prev);
      for (const path of paths) next.add(path);
      return next;
    });
  }, []);

  const noteDirtyPath = useCallback((name: string | undefined) => {
    if (!name) return;
    setDirtyPaths((prev) => {
      if (prev.has(name)) return prev;
      const next = new Set(prev);
      next.add(name);
      return next;
    });
  }, []);

  const markAttentionPaths = useCallback((paths: string[]) => {
    const next = paths.filter(Boolean);
    if (next.length === 0) return;
    if (attentionTimerRef.current) clearTimeout(attentionTimerRef.current);
    setAttentionPaths(new Set(next));
    attentionTimerRef.current = setTimeout(() => {
      setAttentionPaths(new Set());
      attentionTimerRef.current = null;
    }, ATTENTION_MS);
  }, []);

  const markAttentionPath = useCallback(
    (name: string | undefined) => {
      if (!name) return;
      markAttentionPaths([name]);
    },
    [markAttentionPaths],
  );

  const getDirtyPaths = useCallback(() => [...dirtyPathsRef.current], []);

  const isJustSaved = useCallback(
    (name: string | undefined) =>
      name ? pathMatches(justSavedPaths, name) : false,
    [justSavedPaths],
  );

  const isDirtyPath = useCallback(
    (name: string | undefined) =>
      name ? pathMatches(dirtyPaths, name) : false,
    [dirtyPaths],
  );

  const isAttentionPath = useCallback(
    (name: string | undefined) =>
      name ? pathMatches(attentionPaths, name) : false,
    [attentionPaths],
  );

  const value = useMemo(
    () => ({
      isJustSaved,
      isDirtyPath,
      isAttentionPath,
      getDirtyPaths,
      commitSavedPaths,
      rollbackSavedPaths,
      noteDirtyPath,
      markAttentionPath,
      markAttentionPaths,
    }),
    [
      isJustSaved,
      isDirtyPath,
      isAttentionPath,
      getDirtyPaths,
      commitSavedPaths,
      rollbackSavedPaths,
      noteDirtyPath,
      markAttentionPath,
      markAttentionPaths,
    ],
  );

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (attentionTimerRef.current) clearTimeout(attentionTimerRef.current);
    };
  }, []);

  return (
    <SaveHighlightContext.Provider value={value}>
      {children}
    </SaveHighlightContext.Provider>
  );
}

export function useJustSaved() {
  return useContext(SaveHighlightContext);
}

export function useFieldSaveState(name: string | undefined) {
  const { isJustSaved, isDirtyPath, isAttentionPath } =
    useContext(SaveHighlightContext);
  const saved = isJustSaved(name);
  const dirty = isDirtyPath(name);
  const attention = isAttentionPath(name);

  return {
    saved,
    dirty,
    attention,
    className: cn(
      saved && "border-success transition-[border-color] duration-300",
      // Yellow attention cue — border only (no ring fill).
      attention &&
        !saved &&
        "border-warning transition-[border-color] duration-300 aria-invalid:border-warning dark:aria-invalid:border-warning",
      dirty &&
        !saved &&
        !attention &&
        "border-warning transition-[border-color] duration-300",
      // Never paint a filled ring over invalid fields — red border is enough.
      "has-[[aria-invalid=true]]:ring-0 aria-invalid:ring-0",
    ),
  };
}

export function useFieldSaveHighlight(name: string | undefined) {
  return useFieldSaveState(name).className;
}

/** Green tick shown at the end of a field after a successful save. */
export function FieldSavedTick({
  name,
  className,
}: {
  name: string | undefined;
  className?: string;
}) {
  const { saved } = useFieldSaveState(name);
  if (!saved || !name) return null;

  return (
    <CheckIcon
      aria-hidden
      className={cn(
        "pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-success",
        className,
      )}
    />
  );
}

export type PolicySaveStatus =
  "idle" | "unsaved" | "saving" | "saved" | "error";

export function PolicySaveStatusBadge({
  status,
}: {
  status: PolicySaveStatus;
}) {
  if (status === "idle") return null;

  // Optimistic flow skips "saving" — keep for rare manual cases.
  if (status === "saving") {
    return (
      <span className="inline-flex h-5 items-center rounded-4xl border border-success/30 bg-success/10 px-2 text-xs font-medium text-success-foreground">
        Saved
      </span>
    );
  }

  if (status === "unsaved") {
    return (
      <span className="inline-flex h-5 items-center rounded-4xl border border-warning/30 bg-warning/10 px-2 text-xs font-medium text-warning-foreground">
        Unsaved changes
      </span>
    );
  }

  if (status === "error") {
    return (
      <span className="inline-flex h-5 items-center rounded-4xl border border-destructive/30 bg-destructive/10 px-2 text-xs font-medium text-destructive">
        Save failed
      </span>
    );
  }

  return (
    <span className="inline-flex h-5 items-center rounded-4xl border border-success/30 bg-success/10 px-2 text-xs font-medium text-success-foreground">
      Saved
    </span>
  );
}
