import type { WholesaleBroker } from "~/lib/db/types";

/** Map an authorised_representative row (or subset) to the app DTO. */
export function normalizeAuthorisedRepresentative(row: {
  authorisedRepresentativeId: number;
  fullName: string;
  companyName: string;
  arNumber: string;
  email: string;
}): WholesaleBroker {
  return {
    authorisedRepresentativeId: row.authorisedRepresentativeId,
    fullName: row.fullName ?? "",
    companyName: row.companyName ?? "",
    arNumber: row.arNumber ?? "",
    email: row.email ?? "",
  };
}
