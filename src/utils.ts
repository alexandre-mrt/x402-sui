import { getJsonRpcFullnodeUrl, SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import type { Network } from "@x402/core/types";
import {
  SUI_ADDRESS_REGEX,
  SUI_DEVNET_CAIP2,
  SUI_MAINNET_CAIP2,
  SUI_TESTNET_CAIP2,
  SUPPORTED_NETWORKS,
  USDC_DEVNET_COIN_TYPE,
  USDC_MAINNET_COIN_TYPE,
  USDC_TESTNET_COIN_TYPE,
} from "./constants.js";

export type SuiNetwork = "mainnet" | "testnet" | "devnet";

export function normalizeNetwork(network: Network): string {
  if (!SUPPORTED_NETWORKS.has(network)) {
    throw new Error(`Unsupported Sui network: ${network}`);
  }
  return network;
}

export function caipToSuiNetwork(network: Network): SuiNetwork {
  const normalized = normalizeNetwork(network);
  switch (normalized) {
    case SUI_MAINNET_CAIP2:
      return "mainnet";
    case SUI_TESTNET_CAIP2:
      return "testnet";
    case SUI_DEVNET_CAIP2:
      return "devnet";
    default:
      throw new Error(`Cannot convert network: ${network}`);
  }
}

export function validateSuiAddress(address: string): boolean {
  return SUI_ADDRESS_REGEX.test(address);
}

export function createSuiClient(network: Network, customRpcUrl?: string): SuiJsonRpcClient {
  const suiNetwork = caipToSuiNetwork(network);
  const url = customRpcUrl ?? getJsonRpcFullnodeUrl(suiNetwork);
  return new SuiJsonRpcClient({ url, network: suiNetwork });
}

export function getUsdcCoinType(network: Network): string {
  const normalized = normalizeNetwork(network);
  switch (normalized) {
    case SUI_MAINNET_CAIP2:
      return USDC_MAINNET_COIN_TYPE;
    case SUI_TESTNET_CAIP2:
      return USDC_TESTNET_COIN_TYPE;
    case SUI_DEVNET_CAIP2:
      return USDC_DEVNET_COIN_TYPE;
    default:
      throw new Error(`No USDC coin type for network: ${network}`);
  }
}

export function convertToTokenAmount(decimalAmount: string, decimals: number): string {
  const trimmed = decimalAmount.trim();
  if (trimmed === "" || !/^-?\d*\.?\d+$/.test(trimmed)) {
    throw new Error(`Invalid amount: ${decimalAmount}`);
  }
  // String-only arithmetic to avoid IEEE 754 floating-point precision loss
  const negative = trimmed.startsWith("-");
  const abs = negative ? trimmed.slice(1) : trimmed;
  const [intPart = "0", decPart = ""] = abs.split(".");
  const paddedDec = decPart.padEnd(decimals, "0").slice(0, decimals);
  const raw = `${intPart}${paddedDec}`.replace(/^0+/, "") || "0";
  return negative && raw !== "0" ? `-${raw}` : raw;
}
