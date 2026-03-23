import * as jose from "jose";

const DEFAULT_ALG = "ES256";

/**
 * Create a JWS compact serialization from a payload.
 */
export async function createJWS(
  payload: Record<string, unknown>,
  privateKey: CryptoKey,
  kid: string,
  alg: string = DEFAULT_ALG,
): Promise<string> {
  return new jose.CompactSign(new TextEncoder().encode(JSON.stringify(payload)))
    .setProtectedHeader({ alg, kid })
    .sign(privateKey);
}

/**
 * Extract and decode the payload from a JWS compact serialization without verifying the signature.
 */
export function extractJWSPayload<T>(jws: string): T {
  const parts = jws.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid JWS compact serialization: expected 3 parts");
  }
  const payloadPart = parts[1];
  if (!payloadPart) {
    throw new Error("Invalid JWS compact serialization: missing payload");
  }
  const decoded = jose.base64url.decode(payloadPart);
  return JSON.parse(new TextDecoder().decode(decoded)) as T;
}

/**
 * Verify a JWS compact serialization against a public key.
 */
export async function verifyJWS(jws: string, publicKey: CryptoKey): Promise<boolean> {
  try {
    await jose.compactVerify(jws, publicKey);
    return true;
  } catch {
    return false;
  }
}
