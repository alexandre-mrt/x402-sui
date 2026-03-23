import type { SIWxPayload, SIWxStorage } from "./types.js";
import { SIWX_HEADER } from "./types.js";
import { verifySuiSIWxSignature } from "./verify.js";

export interface AfterSettleHook {
  (payerAddress: string, resourceUrl: string): Promise<void>;
}

export function createSIWxSettleHook(storage: SIWxStorage): AfterSettleHook {
  return async (payerAddress: string, resourceUrl: string): Promise<void> => {
    await storage.recordPayment(resourceUrl, payerAddress);
  };
}

export interface SIWxRequestResult {
  granted: boolean;
  address?: string;
}

export function createSIWxRequestHook(
  storage: SIWxStorage,
): (headers: Record<string, string>, resourceUrl: string) => Promise<SIWxRequestResult> {
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

    if (payload.expirationTime) {
      const expiration = new Date(payload.expirationTime);
      if (expiration <= new Date()) {
        return { granted: false };
      }
    }

    if (storage.hasUsedNonce) {
      const used = await storage.hasUsedNonce(payload.nonce);
      if (used) {
        return { granted: false };
      }
    }

    const signatureValid = await verifySuiSIWxSignature(payload);
    if (!signatureValid) {
      return { granted: false };
    }

    const hasPaid = await storage.hasPaid(resourceUrl, payload.address);
    if (!hasPaid) {
      return { granted: false };
    }

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
