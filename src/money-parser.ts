import type { AssetAmount, MoneyParser, Network } from "@x402/core/types";
import type { SuiToken } from "./tokens.js";
import { KNOWN_TOKENS } from "./tokens.js";
import { convertToTokenAmount } from "./utils.js";

/**
 * Creates a MoneyParser bound to a specific token.
 * Always returns an AssetAmount for the given token (never null).
 */
export function createTokenMoneyParser(token: SuiToken): MoneyParser {
  return async (amount: number, _network: Network): Promise<AssetAmount> => {
    const atomicAmount = convertToTokenAmount(String(amount), token.decimals);
    return {
      asset: token.coinType,
      amount: atomicAmount,
    };
  };
}

/**
 * Creates a MoneyParser that resolves tokens from the registry by network.
 * Defaults to USDC for the given network if available.
 * Custom tokens can be provided to extend or override the registry.
 */
export function createSuiMoneyParser(customTokens?: SuiToken[]): MoneyParser {
  return async (amount: number, network: Network): Promise<AssetAmount | null> => {
    // Use first custom token if provided (preferred token for this parser)
    if (customTokens && customTokens.length > 0) {
      const token = customTokens[0];
      if (token) {
        return {
          asset: token.coinType,
          amount: convertToTokenAmount(String(amount), token.decimals),
        };
      }
    }

    // Fall back to USDC from registry
    const registryTokens = KNOWN_TOKENS[network];
    if (!registryTokens) {
      return null;
    }

    const usdc = registryTokens.find((t) => t.symbol === "USDC");
    if (!usdc) {
      return null;
    }

    return {
      asset: usdc.coinType,
      amount: convertToTokenAmount(String(amount), usdc.decimals),
    };
  };
}
