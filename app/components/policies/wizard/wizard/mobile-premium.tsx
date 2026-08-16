import { PremiumPanel } from "../components/premium-panel";
import { useWizardInner } from "./provider";

export function MobilePremium() {
  const { state, props } = useWizardInner();
  const {
    policy,
    reference,
    clientName = "",
    brokerName = "",
    brokerEmail = "",
    emailTemplates = [],
    emailDirectory = [],
    emailTemplateVars,
    footerImageWidth,
    carWording,
  } = props;

  return (
    <div className="xl:hidden">
      <PremiumPanel
        documentsOnly
        premium={state.premium}
        referralReasons={state.referralReasons}
        isCalculating={state.isCalculating}
        documents={state.documents}
        isGeneratingDocuments={state.isGeneratingDocuments}
        policyNumber={state.livePolicyNumber}
        clientName={clientName}
        brokerName={brokerName}
        brokerEmail={brokerEmail}
        emailTemplates={emailTemplates}
        emailDirectory={emailDirectory}
        emailTemplateVars={emailTemplateVars}
        footerImageWidth={footerImageWidth}
        policy={policy}
        getPreviewPolicy={state.buildDocumentSnapshot}
        carWording={carWording}
        brokerFeeLines={reference.feeNames}
        className={state.borderClassName}
      />
    </div>
  );
}
