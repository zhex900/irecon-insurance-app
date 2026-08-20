/**
 * Seed local Postgres with Faker-generated demo clients + policies.
 *
 * Does NOT truncate existing data — appends new rows.
 *
 * Usage:
 *   npm run db:seed:faker
 *   npm run db:seed:faker -- --clients 200 --policies 500
 */
import "dotenv/config";
import { faker } from "@faker-js/faker";
import { createClient } from "../app/lib/services/clients/service";
import { createPolicyDraft } from "../app/lib/services/policy/data.service";
import { getReferenceDataAsync } from "../app/lib/services/reference.service";
import { listAuthorisedRepresentatives } from "../app/lib/services/authorised-representatives/service";
import type { Policy } from "../app/lib/db/types";

const AU_STATES: Array<{ stateId: number; code: string; postcodes: string[] }> =
  [
    { stateId: 1, code: "ACT", postcodes: ["2600", "2601", "2612", "2913"] },
    {
      stateId: 2,
      code: "NSW",
      postcodes: ["2000", "2010", "2060", "2150", "2500"],
    },
    { stateId: 3, code: "NT", postcodes: ["0800", "0810", "0820"] },
    { stateId: 4, code: "QLD", postcodes: ["4000", "4006", "4101", "4217"] },
    { stateId: 5, code: "SA", postcodes: ["5000", "5006", "5067"] },
    { stateId: 6, code: "TAS", postcodes: ["7000", "7005", "7250"] },
    { stateId: 7, code: "VIC", postcodes: ["3000", "3006", "3121", "3141"] },
    { stateId: 8, code: "WA", postcodes: ["6000", "6005", "6151"] },
  ];

function parseArgs(argv: string[]) {
  let clients = 200;
  let policies = 500;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--clients") clients = Number(argv[++i]) || clients;
    else if (arg === "--policies") policies = Number(argv[++i]) || policies;
  }
  return { clients, policies };
}

function fakeAbn() {
  // 11 digits, spaced like common AU display (not a valid checksum).
  const digits = faker.string.numeric({ length: 11, allowLeadingZeros: false });
  return `${digits.slice(0, 2)} ${digits.slice(2, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
}

function fakePhone() {
  return faker.helpers.arrayElement([
    `04${faker.string.numeric(8)}`,
    `0${faker.helpers.arrayElement(["2", "3", "7", "8"])}${faker.string.numeric(8)}`,
  ]);
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function money(min: number, max: number) {
  return Number(faker.number.float({ min, max, fractionDigits: 2 }).toFixed(2));
}

async function seedClients(count: number) {
  const reference = await getReferenceDataAsync();
  const ars = await listAuthorisedRepresentatives();
  if (ars.length === 0) {
    throw new Error(
      "No authorised representatives found. Run `npm run db:seed` first.",
    );
  }

  const managerIds = reference.accountManagers.map((m) => m.accountManagerId);
  const clientSourceIds = reference.clientSources.map((s) => s.clientSourceId);
  const arIds = ars.map((ar) => ar.authorisedRepresentativeId);

  const createdIds: string[] = [];
  console.log(`Creating ${count} clients…`);

  for (let i = 0; i < count; i += 1) {
    const company = faker.company.name();
    const client = await createClient({
      name: company,
      tradingName: faker.datatype.boolean(0.7) ? faker.company.name() : company,
      abn: fakeAbn(),
      phone: fakePhone(),
      email: faker.internet.email({ provider: "example.com" }).toLowerCase(),
      accountManagerId: faker.helpers.arrayElement(managerIds),
      clientSourceId: faker.helpers.arrayElement(clientSourceIds),
      authorisedRepresentativeId: faker.helpers.arrayElement(arIds),
    });
    createdIds.push(client.clientId);
    if ((i + 1) % 25 === 0 || i + 1 === count) {
      console.log(`  clients ${i + 1}/${count}`);
    }
  }

  return createdIds;
}

async function seedPolicies(count: number, clientIds: string[]) {
  if (clientIds.length === 0) {
    throw new Error("No client IDs available for policy seed.");
  }

  const reference = await getReferenceDataAsync();
  console.log(`Creating ${count} policies…`);

  for (let i = 0; i < count; i += 1) {
    const clientId = faker.helpers.arrayElement(clientIds);
    const state = faker.helpers.arrayElement(AU_STATES);
    const postcode = faker.helpers.arrayElement(state.postcodes);
    const coverTypeId = faker.helpers.arrayElement([1, 2, 3]);
    const policyStatusId = faker.helpers.weightedArrayElement([
      { weight: 4, value: 1 }, // Pending
      { weight: 5, value: 2 }, // Taken
      { weight: 1, value: 3 }, // Not taken
    ]);
    const isDraft = policyStatusId === 1 && faker.datatype.boolean(0.25);

    const start = faker.date.between({
      from: "2024-01-01",
      to: "2026-06-01",
    });
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + 1);
    end.setDate(end.getDate() - 1);

    const street = faker.location.streetAddress();
    const suburb = faker.location.city();
    const siteAddress = `${street}, ${suburb} ${state.code} ${postcode}`;

    const estimatedTurnover = faker.number.int({
      min: 250_000,
      max: 8_000_000,
    });
    const plantEquipment = faker.helpers.arrayElement([
      0, 25_000, 50_000, 75_000, 100_000, 150_000,
    ]);

    const subLimits =
      coverTypeId === 3
        ? reference.defaultSubLimits.ownerBuilder
        : reference.defaultSubLimits.annual;

    await createPolicyDraft(clientId, {
      policyCategoryId: faker.helpers.arrayElement([1, 2]),
      policyStatusId,
      postcode,
      stateId: state.stateId,
      dateEffective: isoDate(start),
      dateStart: isoDate(start),
      dateEnd: isoDate(end),
      isDraft,
      insurerCode: reference.insurers[0]?.code ?? "ATC",
      car: {
        coverTypeId,
        annualCoverTypeId: coverTypeId === 1 ? 1 : null,
        siteAddress,
        insuredName: faker.company.name(),
        estimatedTurnover,
        businessActivities: reference.defaultTexts.businessActivities,
        insuredContracts:
          coverTypeId === 1
            ? reference.defaultTexts.insuredContractsAnnualTransfer
            : "Contracts as declared",
        geographicalScopes:
          coverTypeId === 1
            ? reference.defaultTexts.geographicalScopeAnnual
            : "As per schedule",
        plantEquipment,
        existingStructure:
          coverTypeId === 2 ? faker.number.int({ min: 0, max: 500_000 }) : 0,
        displayHomes:
          coverTypeId === 1
            ? faker.helpers.arrayElement([0, 0, 50_000, 100_000])
            : 0,
        claimsCountLast3Years: faker.helpers.weightedArrayElement([
          { weight: 8, value: 0 },
          { weight: 2, value: 1 },
          { weight: 1, value: 2 },
        ]),
        anyClaimsExceed20k: faker.datatype.boolean(0.1),
        declarationConfirmed: !isDraft,
        contractWorksSumInsured:
          coverTypeId === 2
            ? faker.number.int({ min: 200_000, max: 5_000_000 })
            : 0,
        liabilityLimitBand: faker.helpers.arrayElement([1, 2, 3]),
        hasExistingContractWorksCover: faker.datatype.boolean(0.15),
        currentInsurer: faker.datatype.boolean(0.15)
          ? faker.company.name()
          : "",
        maximumConstructionPeriod: faker.helpers.arrayElement([12, 18, 24]),
        maximumMaintenancePeriod: faker.helpers.arrayElement([6, 12]),
        contractWorksExistingStructurePremium: 0,
        contractWorksDisplayHomesPremium: 0,
        subLimits: { ...subLimits },
        excesses: {
          ...reference.defaultExcesses,
          excessAdditionalNotes: "",
        },
        excludedContracts1: reference.defaultTexts.excludedContracts1,
        excludedContracts2: reference.defaultTexts.excludedContracts2,
        excludedContracts3: reference.defaultTexts.excludedContracts3,
        selectedWordingIds: [],
        customWordings: [],
        referralReasons: [],
        premium: isDraft
          ? undefined
          : ({
              contractWorksCalculatedBasePremium: money(2_000, 20_000),
              contractWorksBasePremium: money(2_000, 20_000),
              contractWorksPlantPremium: money(0, 3_000),
              contractWorksPlantESL: money(0, 300),
              contractWorksESL: money(100, 2_000),
              contractWorksGST: money(200, 2_500),
              contractWorksStampDuty: money(100, 1_500),
              contractWorksTerrorismPremium: money(0, 500),
              contractWorksPlantTerrorismPremium: money(0, 100),
              contractWorksDisplayHomesPremium: 0,
              contractWorksExistingStructurePremium: 0,
              contractWorksTotalPremium: money(3_000, 28_000),
              liabilityCalculatedBasePremium: money(1_000, 8_000),
              liabilityBasePremium: money(1_000, 8_000),
              liabilityESL: money(50, 800),
              liabilityGST: money(100, 1_000),
              liabilityStampDuty: money(50, 600),
              liabilityTotalPremium: money(1_200, 10_000),
              combinedBrokerFee: money(100, 400),
              originalTotalPremium: money(5_000, 35_000),
            } satisfies NonNullable<Policy["car"]["premium"]>),
      },
    });

    if ((i + 1) % 50 === 0 || i + 1 === count) {
      console.log(`  policies ${i + 1}/${count}`);
    }
  }
}

async function main() {
  const { clients, policies } = parseArgs(process.argv.slice(2));
  faker.seed(20260727);

  console.log(
    `Faker seed: ${clients} clients, ${policies} policies (append mode)`,
  );

  const clientIds = await seedClients(clients);
  await seedPolicies(policies, clientIds);

  console.log("Done.");
  console.log(`  Created ${clientIds.length} clients`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
