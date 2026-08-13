import { CarPolicyWizardContainer } from "./car-policy-wizard-container";
import { CarPolicyWizardHeader } from "./car-policy-wizard-header";
import { CarPolicyWizardDesktopRail } from "./car-policy-wizard-desktop-rail";
import { CarPolicyWizardInformationCard } from "./car-policy-wizard-information-card";
import { CarPolicyWizardPremiumPanel } from "./car-policy-wizard-premium-panel";
import { CarPolicyWizardMobileNotes } from "./car-policy-wizard-mobile-notes";
import { WizardSectionStack } from "./section-stack";
import { WizardFormFooter } from "./form-footer";
import { CarPolicyWizardDialogs } from "./car-policy-wizard-dialogs";
import { MobileSectionNav } from "./mobile-section-nav";
import { CarPolicyWizardInnerCompound } from "./car-policy-wizard-inner-compound";

// Export everything as a compound component object
export const CarPolicyWizard = {
  // Layout components
  Container: CarPolicyWizardContainer,
  Header: CarPolicyWizardHeader,
  Navigation: MobileSectionNav, // Mobile navigation component
  DesktopRail: CarPolicyWizardDesktopRail,
  InformationCard: CarPolicyWizardInformationCard,
  PremiumPanel: CarPolicyWizardPremiumPanel,
  Sections: WizardSectionStack,
  Footer: WizardFormFooter,
  Dialogs: CarPolicyWizardDialogs,
  MobileNotes: CarPolicyWizardMobileNotes,
  
  // Inner compound component (complete wizard with state management)
  Inner: CarPolicyWizardInnerCompound,
};

// Re-export types for easier consumption
export type { CarPolicyWizardContainerProps } from "./car-policy-wizard-container";
export type { CarPolicyWizardHeaderProps } from "./car-policy-wizard-container";
export type { CarPolicyWizardDesktopRailProps } from "./car-policy-wizard-container";
export type { CarPolicyWizardMainContentProps, CarPolicyWizardPremiumAsideProps, CarPolicyWizardGridProps } from "./car-policy-wizard-container";

// Re-export inner compound types
export type { CarPolicyWizardInnerProviderProps } from "./car-policy-wizard-inner-compound";