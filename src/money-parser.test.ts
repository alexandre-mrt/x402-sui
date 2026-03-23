import { describe, expect, it } from "vitest";
import { USDC_MAINNET_COIN_TYPE, USDC_TESTNET_COIN_TYPE } from "./constants.js";
import { createSuiMoneyParser, createTokenMoneyParser } from "./money-parser.js";
import type { SuiToken } from "./tokens.js";

const NETWORK_MAINNET = "sui:mainnet";
const NETWORK_TESTNET = "sui:testnet";

describe("createTokenMoneyParser", () => {
  const suiToken: SuiToken = {
    symbol: "SUI",
    coinType: "0x2::sui::SUI",
    decimals: 9,
    name: "Sui",
  };

  it("converts amount using token decimals", async () => {
    const parser = createTokenMoneyParser(suiToken);
    const result = await parser(1.5, NETWORK_MAINNET);

    expect(result).not.toBeNull();
    expect(result?.asset).toBe("0x2::sui::SUI");
    expect(result?.amount).toBe("1500000000");
  });

  it("converts a small amount correctly", async () => {
    const parser = createTokenMoneyParser(suiToken);
    // 0.001 SUI = 1_000_000 MIST (9 decimals)
    const result = await parser(0.001, NETWORK_MAINNET);

    expect(result?.amount).toBe("1000000");
  });

  it("converts integer amount", async () => {
    const parser = createTokenMoneyParser(suiToken);
    const result = await parser(10, NETWORK_MAINNET);

    expect(result?.amount).toBe("10000000000");
  });

  it("works with 6-decimal token (USDC)", async () => {
    const usdcToken: SuiToken = {
      symbol: "USDC",
      coinType: USDC_MAINNET_COIN_TYPE,
      decimals: 6,
      name: "USD Coin",
    };
    const parser = createTokenMoneyParser(usdcToken);
    const result = await parser(1.5, NETWORK_MAINNET);

    expect(result?.asset).toBe(USDC_MAINNET_COIN_TYPE);
    expect(result?.amount).toBe("1500000");
  });
});

describe("createSuiMoneyParser", () => {
  it("defaults to USDC on mainnet", async () => {
    const parser = createSuiMoneyParser();
    const result = await parser(1, NETWORK_MAINNET);

    expect(result).not.toBeNull();
    expect(result?.asset).toBe(USDC_MAINNET_COIN_TYPE);
    expect(result?.amount).toBe("1000000");
  });

  it("defaults to USDC on testnet", async () => {
    const parser = createSuiMoneyParser();
    const result = await parser(2.5, NETWORK_TESTNET);

    expect(result).not.toBeNull();
    expect(result?.asset).toBe(USDC_TESTNET_COIN_TYPE);
    expect(result?.amount).toBe("2500000");
  });

  it("returns null for unknown network", async () => {
    const parser = createSuiMoneyParser();
    const result = await parser(1, "eip155:1");

    expect(result).toBeNull();
  });

  it("uses custom tokens when provided", async () => {
    const customToken: SuiToken = {
      symbol: "CUSTOM",
      coinType: "0xcustom::token::TOKEN",
      decimals: 8,
      name: "Custom Token",
    };
    const parser = createSuiMoneyParser([customToken]);
    const result = await parser(1, NETWORK_MAINNET);

    expect(result).not.toBeNull();
    expect(result?.asset).toBe("0xcustom::token::TOKEN");
    expect(result?.amount).toBe("100000000");
  });

  it("handles zero amount", async () => {
    const parser = createSuiMoneyParser();
    const result = await parser(0, NETWORK_MAINNET);

    expect(result?.amount).toBe("0");
  });
});
