import referenceSeed from "~/data/reference.json";
import carWordingSeed from "~/data/car-wording.json";
import { jsonServerRequest } from "~/lib/api/json-server";
import type {
  BrokerSession,
  CarWording,
  Client,
  PolicySummary,
  Quote,
  ReferenceData,
} from "~/lib/db/types";

type DbClient = Client & { id: number };
type DbQuote = Quote & { id: number };

const brokerSession: BrokerSession = {
  id: "broker-demo",
  fullName: "Demo Broker",
  email: "broker@demo.local",
  arId: 1,
};

export function getBrokerSession() {
  return brokerSession;
}

export function getReferenceData(): ReferenceData {
  return referenceSeed as ReferenceData;
}

export function getCarWording(): CarWording[] {
  return carWordingSeed as CarWording[];
}

function stripClient({ id: _id, ...client }: DbClient): Client {
  return client;
}

function stripQuote({ id: _id, ...quote }: DbQuote): Quote {
  return normalizeQuote(quote);
}

export async function listClients(search?: string) {
  const clients = (await jsonServerRequest<DbClient[]>("/clients")).map(stripClient);
  if (!search?.trim()) return clients;
  const q = search.toLowerCase();
  return clients.filter(
    (client) =>
      client.name.toLowerCase().includes(q) ||
      client.tradingName.toLowerCase().includes(q),
  );
}

export async function getClient(clientId: number) {
  try {
    const client = await jsonServerRequest<DbClient>(`/clients/${clientId}`);
    return stripClient(client);
  } catch {
    return null;
  }
}

export async function createClient(
  input: Omit<Client, "clientId" | "createdWhen" | "createdBy" | "arId">,
) {
  const clients = await jsonServerRequest<DbClient[]>("/clients");
  const nextClientId = Math.max(0, ...clients.map((client) => client.clientId)) + 1;
  const client: DbClient = {
    id: nextClientId,
    clientId: nextClientId,
    arId: brokerSession.arId,
    createdWhen: new Date().toISOString(),
    createdBy: brokerSession.email,
    ...input,
  };
  const created = await jsonServerRequest<DbClient>("/clients", {
    method: "POST",
    body: JSON.stringify(client),
  });
  return stripClient(created);
}

export async function listQuotes(clientId?: number) {
  const path = clientId ? `/quotes?clientId=${clientId}` : "/quotes";
  const quotes = await jsonServerRequest<DbQuote[]>(path);
  return quotes.map(stripQuote);
}

export async function listPolicySummaries(search?: string): Promise<PolicySummary[]> {
  const [quotes, clients] = await Promise.all([listQuotes(), listClients()]);
  const clientById = new Map(clients.map((client) => [client.clientId, client.name]));

  const summaries = quotes
    .map((quote) => ({
      policyId: quote.policyId,
      policyNumber: quote.policyNumber,
      insuredName: quote.car.insuredName,
      clientName: clientById.get(quote.clientId) ?? "",
      carStatusId: quote.carStatusId,
      isDraft: quote.isDraft,
      createdWhen: quote.createdWhen,
    }))
    .sort((a, b) => b.createdWhen.localeCompare(a.createdWhen));

  if (!search?.trim()) {
    return summaries.map(({ createdWhen: _createdWhen, ...summary }) => summary);
  }

  const q = search.toLowerCase();
  return summaries
    .filter(
      (summary) =>
        summary.policyNumber.toLowerCase().includes(q) ||
        summary.insuredName.toLowerCase().includes(q) ||
        summary.clientName.toLowerCase().includes(q) ||
        String(summary.policyId).includes(q),
    )
    .map(({ createdWhen: _createdWhen, ...summary }) => summary);
}

export async function getQuote(policyId: number) {
  try {
    const quote = await jsonServerRequest<DbQuote>(`/quotes/${policyId}`);
    return stripQuote(quote);
  } catch {
    return null;
  }
}

function normalizeQuote(quote: Quote): Quote {
  const ref = getReferenceData();
  return {
    ...quote,
    insurerCode: quote.insurerCode ?? ref.insurers[0].code,
    car: {
      ...quote.car,
      subLimits: quote.car.subLimits ?? { ...ref.defaultSubLimits.annual },
      excesses: quote.car.excesses ?? {
        ...ref.defaultExcesses,
        excessAdditionalNotes: "",
      },
      excludedContracts1:
        quote.car.excludedContracts1 ?? ref.defaultTexts.excludedContracts1,
      excludedContracts2:
        quote.car.excludedContracts2 ?? ref.defaultTexts.excludedContracts2,
      excludedContracts3:
        quote.car.excludedContracts3 ?? ref.defaultTexts.excludedContracts3,
      selectedWordingIds: quote.car.selectedWordingIds ?? [],
      referralReasons: quote.car.referralReasons ?? [],
    },
  };
}

export async function saveQuote(quote: Quote) {
  const payload: DbQuote = {
    id: quote.policyId,
    ...quote,
  };
  const saved = await jsonServerRequest<DbQuote>(`/quotes/${quote.policyId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
  return stripQuote(saved);
}

export async function createQuoteDraft(clientId: number, partial: Partial<Quote> = {}) {
  const ref = getReferenceData();
  const client = await getClient(clientId);
  if (!client) throw new Error("Client not found");

  const quotes = await jsonServerRequest<DbQuote[]>("/quotes");
  const policyId = Math.max(1000, ...quotes.map((quote) => quote.policyId), 0) + 1;
  const policyNumber = `ATCCW${String(policyId).padStart(4, "0")}`;
  const today = new Date();
  const nextYear = new Date(today);
  nextYear.setFullYear(nextYear.getFullYear() + 1);
  nextYear.setDate(nextYear.getDate() - 1);

  const quote: DbQuote = {
    id: policyId,
    policyId,
    clientId,
    policyNumber,
    policyActionId: 1,
    carStatusId: 1,
    postcode: "",
    stateId: 2,
    dateEffective: today.toISOString().slice(0, 10),
    dateStart: today.toISOString().slice(0, 10),
    dateEnd: nextYear.toISOString().slice(0, 10),
    createdWhen: new Date().toISOString(),
    createdBy: brokerSession.email,
    insurerCode: ref.insurers[0].code,
    isDraft: true,
    car: {
      coverTypeId: 1,
      siteAddress: "",
      insuredName: client.name,
      estimatedTurnover: 0,
      businessActivities: ref.defaultTexts.businessActivities,
      insuredContracts: ref.defaultTexts.insuredContractsAnnual,
      geographicalScopes: ref.defaultTexts.geographicalScopeAnnual,
      plantEquipment: 0,
      existingStructure: 0,
      displayHomes: 0,
      numberOfClaim: 0,
      anyClaimsExceed20k: false,
      confirmation: false,
      section1Value: 0,
      section2Value: 1,
      holdCurrentContractWorks: false,
      currentInsurer: "",
      maximumConstructionPeriod: 18,
      maximumMaintenancePeriod: 12,
      section1ExistingStructure: 0,
      section1DisplayHomes: 0,
      subLimits: { ...ref.defaultSubLimits.annual },
      excesses: {
        ...ref.defaultExcesses,
        excessAdditionalNotes: "",
      },
      excludedContracts1: ref.defaultTexts.excludedContracts1,
      excludedContracts2: ref.defaultTexts.excludedContracts2,
      excludedContracts3: ref.defaultTexts.excludedContracts3,
      selectedWordingIds: [],
      referralReasons: [],
    },
    ...partial,
  };

  const created = await jsonServerRequest<DbQuote>("/quotes", {
    method: "POST",
    body: JSON.stringify(quote),
  });
  return stripQuote(created);
}

export async function getDashboardStats() {
  const [clients, quotes] = await Promise.all([
    jsonServerRequest<DbClient[]>("/clients"),
    jsonServerRequest<DbQuote[]>("/quotes"),
  ]);

  return {
    clients: clients.length,
    quotes: quotes.length,
    pending: quotes.filter((quote) => quote.carStatusId === 1).length,
    taken: quotes.filter((quote) => quote.carStatusId === 2).length,
  };
}
