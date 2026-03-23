import type { Signer } from "@mysten/sui/cryptography";
import { formatSuiSIWxMessage } from "./message.js";
import type { SIWxExtensionInfo, SIWxPayload } from "./types.js";

export async function createSIWxPayload(
  signer: Signer,
  info: SIWxExtensionInfo,
): Promise<SIWxPayload> {
  const address = signer.toSuiAddress();
  const message = formatSuiSIWxMessage({ ...info, address });
  const messageBytes = new TextEncoder().encode(message);

  const { signature } = await signer.signPersonalMessage(messageBytes);

  return {
    domain: info.domain,
    address,
    uri: info.uri,
    version: info.version,
    chainId: info.chainId,
    type: info.type,
    nonce: info.nonce,
    issuedAt: info.issuedAt,
    expirationTime: info.expirationTime,
    statement: info.statement,
    signature,
  };
}

export function encodeSIWxHeader(payload: SIWxPayload): string {
  return btoa(JSON.stringify(payload));
}
