import type { ReactNode } from "react";
import { createContext, useContext, useMemo } from "react";
import { useWizardState } from "../components/use-wizard-state";
import type { WizardProps } from "../shared/wizard-shared";

// Context for wizard inner state
type WizardInnerState = ReturnType<typeof useWizardState>;

interface WizardInnerContextValue {
  state: WizardInnerState;
  props: Omit<WizardProps, "readOnly" | "isNew" | "freshSteps">;
}

const WizardInnerContext = createContext<WizardInnerContextValue | null>(null);

function useWizardInner() {
  const context = useContext(WizardInnerContext);
  if (!context) {
    throw new Error("useWizardInner must be used within a WizardInnerProvider");
  }
  return context;
}

// Provider component
interface WizardInnerProviderProps extends Omit<
  WizardProps,
  "readOnly" | "isNew" | "freshSteps"
> {
  children: ReactNode;
}

export function WizardInnerProvider({
  policy,
  reference,
  carWording,
  clientName = "",
  brokerName = "",
  brokerEmail = "",
  noteAuthors: initialNoteAuthors,
  emailTemplates = [],
  emailDirectory = [],
  emailTemplateVars,
  footerImageWidth,
  headerActions,
  children,
}: WizardInnerProviderProps) {
  const state = useWizardState({
    policy,
    reference,
    carWording,
    clientName,
    brokerName,
    brokerEmail,
    noteAuthors: initialNoteAuthors,
    emailTemplates,
    emailDirectory,
    emailTemplateVars,
    footerImageWidth,
    headerActions,
  });

  const props = useMemo(
    () => ({
      policy,
      reference,
      carWording,
      clientName,
      brokerName,
      brokerEmail,
      noteAuthors: initialNoteAuthors,
      emailTemplates,
      emailDirectory,
      emailTemplateVars,
      footerImageWidth,
      headerActions,
    }),
    [
      policy,
      reference,
      carWording,
      clientName,
      brokerName,
      brokerEmail,
      initialNoteAuthors,
      emailTemplates,
      emailDirectory,
      emailTemplateVars,
      footerImageWidth,
      headerActions,
    ],
  );

  const value = useMemo(
    () => ({
      state,
      props,
    }),
    [state, props],
  );

  return (
    <WizardInnerContext.Provider value={value}>
      {children}
    </WizardInnerContext.Provider>
  );
}

// Export the hook for internal use
export { useWizardInner };