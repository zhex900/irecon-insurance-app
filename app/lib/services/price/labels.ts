import type { PriceCatalogueKind } from "./types";

/** Label for audit summaries. */
export function catalogueLabel(kind: PriceCatalogueKind): string {
  switch (kind) {
    case "car":
      return "CAR rates";
    case "stamp":
      return "Stamp duty";
    case "esl":
      return "ESL";
    case "plant":
      return "Plant";
    case "terror":
      return "Terrorism";
    case "fees":
      return "Broker fees";
  }
}
