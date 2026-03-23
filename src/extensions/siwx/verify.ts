import { verifyPersonalMessageSignature } from "@mysten/sui/verify";
import { formatSuiSIWxMessage } from "./message.js";
import type { SIWxPayload } from "./types.js";

export async function verifySuiSIWxSignature(payload: SIWxPayload): Promise<boolean> {
  const message = formatSuiSIWxMessage(payload);
  const messageBytes = new TextEncoder().encode(message);

  try {
    await verifyPersonalMessageSignature(messageBytes, payload.signature, {
      address: payload.address,
    });
    return true;
  } catch {
    return false;
  }
}
