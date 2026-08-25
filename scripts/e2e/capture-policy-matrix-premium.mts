/**
 * Print premium expected values for policy-matrix fixtures (paste into *.ts).
 *
 * Usage (CI seed DB must be running):
 *   npm run ci:db
 *   npx tsx scripts/e2e/capture-policy-matrix-premium.mts [scenario-id...]
 */
import "dotenv/config";

import { rollupPremiumTotals } from "~/lib/pricing/premium-totals";
import { getReferenceData } from "~/lib/services/reference.service";
import { calculatePremiumForPolicy } from "~/lib/services/price/premium.service";
import { formatCurrency } from "~/lib/utils";
import type { CarPolicyFormValues } from "~/lib/zod/policy-car";

import {
  getPolicyMatrixFixture,
  type PolicyMatrixInput,
} from "../../tests/e2e/fixtures/policy-matrix";

function toFormValues(input: PolicyMatrixInput): CarPolicyFormValues {
  const ref = getReferenceData();
  const stateId =
    ref.states.find((item) => item.code === input.form.state)?.stateId ?? 2;
  const liabilityLimitBand =
    ref.liabilityLimitBands.find(
      (item) => item.name === input.form.liabilityLimitBand,
    )?.id ?? 1;

  return {
    coverTypeId: input.coverTypeId,
    annualCoverTypeId: input.annualCoverTypeId,
    siteAddress: input.form.siteAddress,
    insuredName: input.form.insuredName,
    estimatedTurnover: input.form.estimatedTurnover,
    businessActivities: ref.defaultTexts.businessActivities,
    insuredContracts:
      input.coverTypeId === 1
        ? ref.defaultTexts.insuredContractsAnnualContractCommencing
        : ref.defaultTexts.insuredContractsSingle,
    geographicalScopes:
      input.coverTypeId === 1
        ? ref.defaultTexts.geographicalScopeAnnual
        : input.form.siteAddress,
    plantEquipment: input.form.plantEquipment,
    existingStructure: input.form.existingStructure,
    displayHomes: input.form.displayHomes,
    claimsCountLast3Years: input.form.claimsCountLast3Years,
    anyClaimsExceed20k: input.form.anyClaimsExceed20k === "Yes",
    declarationConfirmed: true,
    contractWorksSumInsured: input.form.contractWorksSumInsured,
    liabilityLimitBand,
    hasExistingContractWorksCover: false,
    currentInsurer: "",
    maximumConstructionPeriod: input.coverTypeId === 1 ? 18 : 12,
    maximumMaintenancePeriod: 12,
    contractWorksExistingStructurePremium: 0,
    contractWorksDisplayHomesPremium: 0,
    dateStart: input.dates.dateStart,
    dateEnd: input.dates.dateEnd,
    premiumBreakdown: "",
    stateId,
    postcode: input.form.postcode,
    insurerCode: ref.insurers[0]?.code ?? "ATC",
  };
}

async function captureScenario(scenarioId: string) {
  const { input } = getPolicyMatrixFixture(scenarioId);
  const raw = await calculatePremiumForPolicy(toFormValues(input));
  const premium = rollupPremiumTotals(raw);

  const snippet = {
    premium: {
      contractWorksTotalPremium: premium.contractWorksTotalPremium,
      liabilityTotalPremium: premium.liabilityTotalPremium,
      originalTotalPremium: premium.originalTotalPremium,
      combinedBrokerFee: premium.combinedBrokerFee,
    },
    premiumDisplay: {
      originalTotalPremium: formatCurrency(premium.originalTotalPremium),
    },
  };

  console.log(`\n${scenarioId} — paste into ${scenarioId}.ts expected:\n`);
  console.log(JSON.stringify(snippet, null, 2));
}

const scenarioIds = process.argv.slice(2);
const targets =
  scenarioIds.length > 0 ? scenarioIds : ["single-pending", "annual-pending"];

for (const id of targets) {
  await captureScenario(id);
}
