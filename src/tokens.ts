import {
  USDC_DEVNET_COIN_TYPE,
  USDC_MAINNET_COIN_TYPE,
  USDC_TESTNET_COIN_TYPE,
} from "./constants.js";

export interface SuiToken {
  symbol: string;
  coinType: string;
  decimals: number;
  name: string;
}

export const KNOWN_TOKENS: Record<string, SuiToken[]> = {
  "sui:mainnet": [
    {
      symbol: "USDC",
      coinType: USDC_MAINNET_COIN_TYPE,
      decimals: 6,
      name: "USD Coin",
    },
    {
      symbol: "SUI",
      coinType: "0x2::sui::SUI",
      decimals: 9,
      name: "Sui",
    },
    {
      symbol: "AUSD",
      coinType: "0x2053d08c1e2bd02791056171aab0fd12bd7cd7efad2ab8f6b9c8902f14df2ff2::ausd::AUSD",
      decimals: 6,
      name: "Agora Dollar",
    },
    {
      symbol: "wUSDT",
      coinType: "0xc060006111016b8a020ad5b33834984a437aaa7d3c74c18e09a95d48aceab08c::coin::COIN",
      decimals: 6,
      name: "Wrapped USDT",
    },
    {
      symbol: "FDUSD",
      coinType: "0xf16e6b723f242ec745dfd7634ad072c42d5c1d9ac9571571571571571571::fdusd::FDUSD",
      decimals: 6,
      name: "First Digital USD",
    },
  ],
  "sui:testnet": [
    {
      symbol: "USDC",
      coinType: USDC_TESTNET_COIN_TYPE,
      decimals: 6,
      name: "USD Coin",
    },
    {
      symbol: "SUI",
      coinType: "0x2::sui::SUI",
      decimals: 9,
      name: "Sui",
    },
  ],
  "sui:devnet": [
    {
      symbol: "USDC",
      coinType: USDC_DEVNET_COIN_TYPE,
      decimals: 6,
      name: "USD Coin",
    },
    {
      symbol: "SUI",
      coinType: "0x2::sui::SUI",
      decimals: 9,
      name: "Sui",
    },
  ],
};

export function findTokenBySymbol(network: string, symbol: string): SuiToken | undefined {
  const tokens = KNOWN_TOKENS[network];
  if (!tokens) {
    return undefined;
  }
  const upperSymbol = symbol.toUpperCase();
  return tokens.find((t) => t.symbol.toUpperCase() === upperSymbol);
}

export function findTokenByCoinType(network: string, coinType: string): SuiToken | undefined {
  const tokens = KNOWN_TOKENS[network];
  if (!tokens) {
    return undefined;
  }
  return tokens.find((t) => t.coinType === coinType);
}
