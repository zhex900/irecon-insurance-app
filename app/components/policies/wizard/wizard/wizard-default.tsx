import { WizardGrid as Grid } from "./wizard-grid";
import { MainContent } from "./main-content";
import { PremiumAside } from "./premium-aside";
import { WizardHeader } from "./wizard-header";
import { WizardDesktopRail } from "./desktop-rail";
import { InfoCard } from "./info-card";
import { MobilePremium } from "./mobile-premium";
import { MobileNotes } from "./mobile-notes";
import { SectionStack } from "./section-stack";
import { FormFooter } from "./form-footer";
import { DesktopPremium } from "./desktop-premium";
import { Dialogs } from "./dialogs";
import { DecomposedContainer as WizardContainer } from "../components/decomposed-container";
import { useMode } from "../hooks/utils/use-mode";

export function WizardDefault() {
  const { wizardMode } = useMode();
  return (
    <WizardContainer wizardMode={wizardMode}>
      <WizardHeader />

      <Grid>
        <WizardDesktopRail />

        <MainContent>
          <InfoCard />
          <MobilePremium />
          <MobileNotes />
          <SectionStack />
          <FormFooter />
        </MainContent>

        <PremiumAside>
          <DesktopPremium />
        </PremiumAside>
      </Grid>

      <Dialogs />
    </WizardContainer>
  );
}
