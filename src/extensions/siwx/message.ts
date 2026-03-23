import type { SIWxExtensionInfo } from "./types.js";

export function formatSuiSIWxMessage(info: SIWxExtensionInfo & { address: string }): string {
  const lines: string[] = [
    `${info.domain} wants you to sign in with your Sui account:`,
    info.address,
  ];

  if (info.statement) {
    lines.push("", info.statement);
  }

  lines.push(
    "",
    `URI: ${info.uri}`,
    `Version: ${info.version}`,
    `Chain ID: ${info.chainId}`,
    `Nonce: ${info.nonce}`,
    `Issued At: ${info.issuedAt}`,
  );

  if (info.expirationTime) {
    lines.push(`Expiration Time: ${info.expirationTime}`);
  }

  return lines.join("\n");
}
