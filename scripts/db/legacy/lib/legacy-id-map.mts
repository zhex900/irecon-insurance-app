/**
 * Deterministic UUIDs for legacy integer PKs (re-runnable migrations).
 */
import { createHash } from "node:crypto";

const LEGACY_NAMESPACE = "irecon-insurance-legacy-v1";

function legacyUuid(kind: string, legacyId: number | string): string {
  const hash = createHash("sha256")
    .update(`${LEGACY_NAMESPACE}:${kind}:${legacyId}`)
    .digest();
  hash[6] = (hash[6]! & 0x0f) | 0x40;
  hash[8] = (hash[8]! & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function legacyClientUuid(legacyClientId: number): string {
  return legacyUuid("client", legacyClientId);
}

export function legacyPolicyUuid(legacyPolicyId: number): string {
  return legacyUuid("policy", legacyPolicyId);
}

export function legacyPolicyDocumentUuid(legacyDocumentId: number): string {
  return legacyUuid("policy-document", legacyDocumentId);
}

export function legacyPolicyNoteUuid(legacyNoteId: number): string {
  return legacyUuid("policy-note", legacyNoteId);
}

export function policyDocumentR2Key(
  policyUuid: string,
  legacyDocumentId: number,
  filename: string,
): string {
  const safe = filename.replace(/[/\\]/g, "_").trim();
  return `policies/${policyUuid}/${legacyDocumentId}-${safe}`;
}
