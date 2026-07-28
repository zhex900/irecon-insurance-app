import { useEffect, useRef } from "react";
import { useNavigation, useSearchParams } from "react-router";
import { toast } from "sonner";

/** Append a one-shot success toast message to a redirect URL. */
export function withSuccessToast(href: string, message: string) {
  const url = new URL(href, "http://local.invalid");
  url.searchParams.set("toast", message);
  return `${url.pathname}${url.search}${url.hash}`;
}

/**
 * Show a green success toast from `?toast=`, then strip the param so a refresh
 * does not repeat it. Mount once in the app shell.
 */
export function useSuccessToastFromSearch() {
  const [searchParams, setSearchParams] = useSearchParams();
  const shownKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const message = searchParams.get("toast");
    if (!message) return;

    const key = `toast:${message}`;
    if (shownKeyRef.current === key) return;
    shownKeyRef.current = key;

    toast.success(message);

    const next = new URLSearchParams(searchParams);
    next.delete("toast");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
}

type ActionSuccess = {
  ok?: boolean;
  message?: string;
  intent?: string;
};

/**
 * Fire a success toast once per successful action while navigation is idle.
 * Waits until a submit/load cycle so stale actionData does not toast on mount.
 */
export function useActionSuccessToast(actionData: ActionSuccess | undefined) {
  const navigation = useNavigation();
  const lastKeyRef = useRef<string | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (navigation.state === "submitting") {
      pendingRef.current = true;
    }
  }, [navigation.state]);

  useEffect(() => {
    if (!pendingRef.current || navigation.state !== "idle") return;
    if (!actionData?.ok || !actionData.message) {
      pendingRef.current = false;
      return;
    }

    const key = `${actionData.intent ?? "ok"}:${actionData.message}`;
    if (lastKeyRef.current === key) {
      pendingRef.current = false;
      return;
    }
    lastKeyRef.current = key;
    pendingRef.current = false;
    toast.success(actionData.message);
  }, [actionData, navigation.state]);
}
