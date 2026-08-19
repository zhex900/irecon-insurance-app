import { startTransition, useDeferredValue, useEffect, useState } from "react";
import type { UseFormReturn } from "react-hook-form";

import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

/**
 * Snapshot the form off the keystroke path. Callers must not useWatch the
 * whole form — this subscription updates in a transition and the snapshot
 * is deferred so schema/nav work does not block typing.
 */
export function useDeferredFormValues(
  form: UseFormReturn<CarPolicyFormValues>,
) {
  const [values, setValues] = useState(() => form.getValues());

  useEffect(() => {
    const subscription = form.watch(() => {
      startTransition(() => {
        setValues(form.getValues());
      });
    });
    return () => subscription.unsubscribe();
  }, [form]);

  return useDeferredValue(values);
}
