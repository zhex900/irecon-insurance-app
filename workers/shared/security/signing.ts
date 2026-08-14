// Shared request signing utilities for service-to-service communication

export interface SignedRequest {
  payload: unknown;
  signature: string;
  timestamp: number;
  serviceName: string;
}

/**
 * Create a cryptographically signed request for service-to-service communication
 */
export async function createSignedRequest(
  payload: unknown,
  serviceName: string,
  sharedSecret: string,
): Promise<SignedRequest> {
  const timestamp = Date.now();
  const dataToSign = `${JSON.stringify(payload)}${timestamp}${serviceName}`;

  const encoder = new TextEncoder();

  try {
    // Import the shared secret as an HMAC key
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(sharedSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );

    // Sign the data
    const signatureBuffer = await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(dataToSign),
    );

    // Convert signature to hex string
    const signatureArray = Array.from(new Uint8Array(signatureBuffer));
    const signatureHex = signatureArray
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return {
      payload,
      signature: signatureHex,
      timestamp,
      serviceName,
    };
  } catch (error) {
    console.error("Failed to create signed request:", error);
    throw new Error("Failed to create signed request", { cause: error });
  }
}

/**
 * Validate a signed request
 */
export async function validateSignedRequest(
  signedRequest: SignedRequest,
  sharedSecret: string,
  maxAgeMs: number = 5 * 60 * 1000, // Default 5 minutes
): Promise<boolean> {
  try {
    // 1. Check timestamp freshness (prevent replay attacks)
    const now = Date.now();
    if (now - signedRequest.timestamp > maxAgeMs) {
      return false; // Request too old
    }

    // 2. Recreate signature and compare
    const dataToVerify = `${JSON.stringify(signedRequest.payload)}${signedRequest.timestamp}${signedRequest.serviceName}`;
    const encoder = new TextEncoder();

    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(sharedSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );

    // Convert hex signature back to buffer
    const signatureMatch = signedRequest.signature.match(/.{1,2}/g);
    if (!signatureMatch) {
      return false; // Invalid signature format
    }
    const signatureBytes = new Uint8Array(
      signatureMatch.map((byte) => parseInt(byte, 16)),
    );

    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(dataToVerify),
    );
  } catch (error) {
    console.error("Failed to validate signed request:", error);
    return false;
  }
}
