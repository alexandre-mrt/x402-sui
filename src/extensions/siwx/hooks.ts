import type { SIWxPayload, SIWxStorage } from "./types.js";
import { SIWX_HEADER } from "./types.js";
import { verifySuiSIWxSignature } from "./verify.js";

export type AfterSettleHook = (payerAddress: string, resourceUrl: string) => Promise<void>;

export function createSIWxSettleHook(storage: SIWxStorage): AfterSettleHook {
  return async (payerAddress: string, resourceUrl: string): Promise<void> => {
    await storage.recordPayment(resourceUrl, payerAddress);
  };
}

export interface SIWxRequestResult {
  granted: boolean;
  address?: string;
}

export interface SIWxRequestHookOptions {
  expectedDomain?: string;
  expectedUri?: string;
  maxIssuedAtAgeMs?: number;
  clockSkewToleranceMs?: number;
}

const DEFAULT_MAX_ISSUED_AT_AGE_MS = 5 * 60 * 1000; // 5 minutes
const DEFAULT_CLOCK_SKEW_MS = 30 * 1000; // 30 seconds

export function createSIWxRequestHook(
  storage: SIWxStorage,
  options: SIWxRequestHookOptions = {},
): (headers: Record<string, string>, resourceUrl: string) => Promise<SIWxRequestResult> {
  const maxAge = options.maxIssuedAtAgeMs ?? DEFAULT_MAX_ISSUED_AT_AGE_MS;
  const clockSkew = options.clockSkewToleranceMs ?? DEFAULT_CLOCK_SKEW_MS;

  return async (
    headers: Record<string, string>,
    resourceUrl: string,
  ): Promise<SIWxRequestResult> => {
    const siwxHeader = headers[SIWX_HEADER];
    if (!siwxHeader) {
      return { granted: false };
    }

    let payload: SIWxPayload;
    try {
      const decoded = atob(siwxHeader);
      payload = JSON.parse(decoded) as SIWxPayload;
    } catch {
      return { granted: false };
    }

    if (!isValidPayload(payload)) {
      return { granted: false };
    }

    // Validate domain binding (prevents cross-domain replay)
    if (options.expectedDomain && payload.domain !== options.expectedDomain) {
      return { granted: false };
    }

    // Validate URI binding
    if (options.expectedUri && payload.uri !== options.expectedUri) {
      return { granted: false };
    }

    const now = Date.now();

    // Validate issuedAt is not in the future (with clock skew tolerance)
    const issuedAt = new Date(payload.issuedAt).getTime();
    if (issuedAt > now + clockSkew) {
      return { granted: false };
    }

    // Validate issuedAt is not too old
    if (now - issuedAt > maxAge) {
      return { granted: false };
    }

    // Validate expiration
    if (payload.expirationTime) {
      const expiration = new Date(payload.expirationTime).getTime();
      if (expiration <= now) {
        return { granted: false };
      }
    }

    // Check nonce replay
    if (storage.hasUsedNonce) {
      const used = await storage.hasUsedNonce(payload.nonce);
      if (used) {
        return { granted: false };
      }
    }

    // Verify cryptographic signature
    const signatureValid = await verifySuiSIWxSignature(payload);
    if (!signatureValid) {
      return { granted: false };
    }

    // Check payment history
    const hasPaid = await storage.hasPaid(resourceUrl, payload.address);
    if (!hasPaid) {
      return { granted: false };
    }

    // Record nonce to prevent replay
    if (storage.recordNonce) {
      await storage.recordNonce(payload.nonce);
    }

    return { granted: true, address: payload.address };
  };
}

function isValidPayload(payload: unknown): payload is SIWxPayload {
  if (typeof payload !== "object" || payload === null) {
    return false;
  }

  const p = payload as Record<string, unknown>;

  return (
    typeof p.domain === "string" &&
    typeof p.address === "string" &&
    typeof p.uri === "string" &&
    typeof p.version === "string" &&
    typeof p.chainId === "string" &&
    p.type === "sui" &&
    typeof p.nonce === "string" &&
    typeof p.issuedAt === "string" &&
    typeof p.signature === "string"
  );
}
