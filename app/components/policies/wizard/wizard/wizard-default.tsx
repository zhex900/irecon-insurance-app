import { WizardContainer } from "../components/wizard-container";
import { useMode } from "../hooks/utils/use-mode";
import { DesktopPremium } from "./desktop-premium";
import { WizardDesktopRail } from "./desktop-rail";
import { Dialogs } from "./dialogs";
import { FormFooter } from "./form-footer";
import { InfoCard } from "./info-card";
import { MobilePremium } from "./mobile-premium";
import { PremiumAside } from "./premium-aside";
import { SectionStack } from "./section-stack";
import { WizardGrid } from "./wizard-grid";
import { WizardHeader } from "./wizard-header";
import { WizardMainContent } from "./wizard-main-content";
import { WizardMobileNotes } from "./wizard-mobile-notes";

export function WizardDefault() {
  const { wizardMode } = useMode();
  return (
    <WizardContainer wizardMode={wizardMode}>
      <WizardHeader />

      <WizardGrid>
        <WizardDesktopRail />

        <WizardMainContent>
          <InfoCard />
          <MobilePremium />
          <WizardMobileNotes />
          <SectionStack />
          <FormFooter />
        </WizardMainContent>

        <PremiumAside>
          <DesktopPremium />
        </PremiumAside>
      </WizardGrid>

      <Dialogs />
    </WizardContainer>
  );
}
