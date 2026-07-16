import { useEffect, useState } from "react";
import { useFetcher, useNavigate, useSearchParams } from "react-router";
import { zodResolver } from "@hookform/resolvers/zod";
import { FormProvider, useForm, type Resolver } from "react-hook-form";
import { Button } from "~/components/ui/button";
import {
  ClaimsWordingStep,
  PremiumSummaryPanel,
  PricingDeclarationConfirmedStep,
  ReviewStep,
  RiskDetailsStep,
  Section1Step,
  Section2ExcessesStep,
} from "~/components/forms/car-quote-sections";
import {
  POLICY_STATUS,
  carQuoteSchema,
  wizardStepFields,
  wizardSteps,
  pricingFields,
  type CarQuoteFormValues,
} from "~/lib/zod/policy-car";
import type { CarWording, Quote, ReferenceData } from "~/lib/db/types";

const PRICING_CONFIRMATION_STEP = wizardSteps.length - 1;

function getInitialStep(quote: Quote) {
  if (quote.car.premium) return PRICING_CONFIRMATION_STEP;
  return 0;
}

type ActionData = {
  ok?: boolean;
  savedAt?: string;
  formError?: string;
  premium?: Quote["car"]["premium"];
  referralReasons?: string[];
  rating?: Quote["car"]["rating"];
  notes?: Quote["notes"];
  errors?: Record<string, string[] | undefined>;
};

export function CarQuoteWizard({
  quote,
  reference,
  carWording,
  readOnly = false,
}: {
  quote: Quote;
  reference: ReferenceData;
  carWording: CarWording[];
  readOnly?: boolean;
}) {
  const [step, setStep] = useState(() => getInitialStep(quote));
  const [maxStep, setMaxStep] = useState(() => getInitialStep(quote));
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const fetcher = useFetcher<ActionData>();
  const draftFetcher = useFetcher<ActionData>();
  const navigate = useNavigate();

  const form = useForm<CarQuoteFormValues>({
    resolver: zodResolver(carQuoteSchema) as Resolver<CarQuoteFormValues>,
    defaultValues: quoteToFormValues(quote),
    mode: "onBlur",
  });

  const isCalculating = fetcher.state !== "idle";
  const isSavingDraft = draftFetcher.state !== "idle";
  const actionData = fetcher.data ?? draftFetcher.data;

  const premium = fetcher.data?.premium ?? quote.car.premium;
  const referralReasons =
    fetcher.data?.referralReasons ?? quote.car.referralReasons ?? [];
  const notes = fetcher.data?.notes ?? quote.notes;
  const canChangeStatus = quote.policyStatusId === POLICY_STATUS.Pending && !readOnly;

  useEffect(() => {
    if (draftFetcher.data?.ok && draftFetcher.data.savedAt) {
      setDraftSavedAt(draftFetcher.data.savedAt);
    }
  }, [draftFetcher.data]);

  async function validateCurrentStep() {
    const fields = wizardStepFields[step];
    if (!fields) return true;
    return form.trigger(fields);
  }

  function goToStep(index: number) {
    if (index < 0 || index >= wizardSteps.length) return;
    setStep(index);
    setMaxStep((current) => Math.max(current, index));
  }

  async function goNext() {
    const valid = await validateCurrentStep();
    if (!valid) return;
    goToStep(Math.min(step + 1, wizardSteps.length - 1));
  }

  function goBack() {
    goToStep(step - 1);
  }

  function submitIntent(intent: "draft" | "recalculate" | "calculate") {
    const values = form.getValues();
    const body = new FormData();
    body.set("intent", intent);
    body.set("payload", JSON.stringify(values));
    const fetcherToUse = intent === "draft" ? draftFetcher : fetcher;
    fetcherToUse.submit(body, { method: "post", action: `/quotes/${quote.policyId}` });
  }

  async function saveDraft() {
    submitIntent("draft");
  }

  async function saveQuote() {
    const valid = await form.trigger();
    if (!valid) return;
    const values = form.getValues();
    const body = new FormData();
    body.set("intent", "save");
    body.set("payload", JSON.stringify(values));
    fetcher.submit(body, { method: "post", action: `/quotes/${quote.policyId}` });
  }

  async function recalculatePremium(advanceToPricing = false) {
    const valid = await form.trigger([...pricingFields]);
    if (!valid) return;
    submitIntent(advanceToPricing ? "calculate" : "recalculate");
    if (advanceToPricing) {
      goToStep(PRICING_CONFIRMATION_STEP);
    }
  }

  const showSavedBanner = searchParams.get("saved") === "1";

  return (
    <FormProvider {...form}>
      <fieldset disabled={readOnly} className="flex flex-col gap-6 border-0 p-0">
        {showSavedBanner ? (
          <div className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
            Quote saved successfully.
          </div>
        ) : null}

        {draftSavedAt ? (
          <div className="rounded-md bg-slate-100 px-4 py-2 text-sm text-slate-600">
            Draft saved at {new Date(draftSavedAt).toLocaleTimeString()}.
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {wizardSteps.map((label, index) => {
            const isActive = index === step;
            const isVisited = index <= maxStep;
            return (
              <button
                key={label}
                type="button"
                onClick={() => goToStep(index)}
                className={`rounded-full px-3 py-1 text-sm transition-colors ${
                  isActive
                    ? "bg-slate-900 text-white"
                    : isVisited
                      ? "bg-slate-300 text-slate-800 hover:bg-slate-400"
                      : "bg-slate-200 text-slate-700 hover:bg-slate-300"
                }`}
              >
                {index + 1}. {label}
              </button>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div>
            {step === 0 ? <RiskDetailsStep reference={reference} /> : null}
            {step === 1 ? <Section1Step /> : null}
            {step === 2 ? <Section2ExcessesStep reference={reference} /> : null}
            {step === 3 ? <ClaimsWordingStep carWording={carWording} /> : null}
            {step === 4 ? (
              <ReviewStep
                reference={reference}
                premium={premium}
                referralReasons={referralReasons}
              />
            ) : null}
            {step === 5 ? (
              <PricingDeclarationConfirmedStep
                premium={premium}
                referralReasons={referralReasons}
                reference={reference}
                notes={notes}
                canChangeStatus={canChangeStatus}
              />
            ) : null}
          </div>
          <PremiumSummaryPanel
            premium={premium}
            referralReasons={referralReasons}
            isCalculating={isCalculating}
          />
        </div>

        {actionData?.formError ? (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
            {actionData.formError}
          </div>
        ) : null}

        {actionData?.errors ? (
          <div className="rounded-md bg-red-50 p-4 text-sm text-red-800">
            <p className="font-medium">Please fix the following errors:</p>
            <ul className="mt-2 list-disc pl-5">
              {Object.entries(actionData.errors).flatMap(([field, messages]) =>
                (messages ?? []).map((msg) => (
                  <li key={`${field}-${msg}`}>
                    {field}: {msg}
                  </li>
                )),
              )}
            </ul>
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={goBack}>
              Back
            </Button>
          ) : null}

          {step < wizardSteps.length - 1 ? (
            <Button type="button" onClick={goNext}>
              Next
            </Button>
          ) : null}

          {!readOnly ? (
            <Button
              type="button"
              variant="secondary"
              onClick={saveDraft}
              disabled={isSavingDraft}
            >
              {isSavingDraft ? "Saving draft…" : "Save Draft"}
            </Button>
          ) : null}

          {!readOnly && step >= 2 ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => recalculatePremium(false)}
              disabled={isCalculating}
            >
              {isCalculating ? "Recalculating…" : "Recalculate Premium"}
            </Button>
          ) : null}

          {!readOnly && step === 4 ? (
            <Button
              type="button"
              onClick={() => recalculatePremium(true)}
              disabled={isCalculating}
            >
              {isCalculating ? "Calculating…" : "Calculate & Continue"}
            </Button>
          ) : null}

          {!readOnly && step === 5 ? (
            <Button type="button" onClick={saveQuote} disabled={isCalculating}>
              {isCalculating ? "Saving…" : "Save Quote"}
            </Button>
          ) : null}

          <Button type="button" variant="ghost" onClick={() => navigate(`/clients/${quote.clientId}`)}>
            {readOnly ? "Back to client" : "Cancel"}
          </Button>
        </div>
      </fieldset>
    </FormProvider>
  );
}

export function quoteToFormValues(quote: Quote): CarQuoteFormValues {
  return {
    clientId: quote.clientId,
    policyStatusId: quote.policyStatusId,
    insurerCode: quote.insurerCode,
    insuredName: quote.car.insuredName,
    coverTypeId: quote.car.coverTypeId,
    businessTypeId: quote.businessTypeId,
    policyNumber: quote.policyNumber,
    siteAddress: quote.car.siteAddress,
    estimatedTurnover: quote.car.estimatedTurnover,
    postcode: quote.postcode,
    stateId: quote.stateId,
    businessActivities: quote.car.businessActivities,
    insuredContracts: quote.car.insuredContracts,
    geographicalScopes: quote.car.geographicalScopes,
    maximumConstructionPeriod: quote.car.maximumConstructionPeriod,
    maximumMaintenancePeriod: quote.car.maximumMaintenancePeriod,
    dateStart: quote.dateStart,
    dateEnd: quote.dateEnd,
    hasExistingContractWorksCover: quote.car.hasExistingContractWorksCover,
    currentInsurer: quote.car.currentInsurer,
    contractWorksSumInsured: quote.car.contractWorksSumInsured,
    displayHomes: quote.car.displayHomes,
    existingStructure: quote.car.existingStructure,
    contractWorksDisplayHomesPremium: quote.car.displayHomes,
    contractWorksExistingStructurePremium: quote.car.existingStructure,
    plantEquipment: quote.car.plantEquipment,
    liabilityLimitBand: quote.car.liabilityLimitBand,
    claimsCountLast3Years: quote.car.claimsCountLast3Years,
    anyClaimsExceed20k: quote.car.anyClaimsExceed20k,
    declarationConfirmed: quote.car.declarationConfirmed,
    subLimits: quote.car.subLimits,
    excesses: quote.car.excesses,
    excludedContracts1: quote.car.excludedContracts1,
    excludedContracts2: quote.car.excludedContracts2,
    excludedContracts3: quote.car.excludedContracts3,
    selectedWordingIds: quote.car.selectedWordingIds,
    customWordingEnabled: Boolean(quote.car.customWordingSubject),
    customWordingSubject: quote.car.customWordingSubject,
    customWordingContent: quote.car.customWordingContent,
  };
}
