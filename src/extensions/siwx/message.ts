import type { SIWxExtensionInfo } from "./types.js";

function sanitize(value: string): string {
  return value.replace(/[\n\r]/g, "");
}

export function formatSuiSIWxMessage(info: SIWxExtensionInfo & { address: string }): string {
  const lines: string[] = [
    `${sanitize(info.domain)} wants you to sign in with your Sui account:`,
    sanitize(info.address),
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
