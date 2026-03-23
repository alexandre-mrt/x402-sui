// CAIP-2 network identifiers for Sui
export const SUI_MAINNET_CAIP2 = "sui:mainnet";
export const SUI_TESTNET_CAIP2 = "sui:testnet";
export const SUI_DEVNET_CAIP2 = "sui:devnet";

// RPC URLs
export const MAINNET_RPC_URL = "https://fullnode.mainnet.sui.io:443";
export const TESTNET_RPC_URL = "https://fullnode.testnet.sui.io:443";
export const DEVNET_RPC_URL = "https://fullnode.devnet.sui.io:443";

// USDC coin types (Circle native USDC on Sui)
export const USDC_MAINNET_COIN_TYPE =
  "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
export const USDC_TESTNET_COIN_TYPE =
  "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";
export const USDC_DEVNET_COIN_TYPE = USDC_TESTNET_COIN_TYPE;

// USDC decimals (same as other chains)
export const USDC_DECIMALS = 6;

// Settlement cache TTL in milliseconds
export const SETTLEMENT_TTL_MS = 120_000;

// Sui address regex (0x followed by 64 hex chars)
export const SUI_ADDRESS_REGEX = /^0x[a-fA-F0-9]{64}$/;

// Supported networks set for quick lookup
export const SUPPORTED_NETWORKS = new Set([SUI_MAINNET_CAIP2, SUI_TESTNET_CAIP2, SUI_DEVNET_CAIP2]);
