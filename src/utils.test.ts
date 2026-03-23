import { describe, expect, it } from "vitest";
import {
  USDC_DEVNET_COIN_TYPE,
  USDC_MAINNET_COIN_TYPE,
  USDC_TESTNET_COIN_TYPE,
} from "./constants.js";
import {
  caipToSuiNetwork,
  convertToTokenAmount,
  getUsdcCoinType,
  normalizeNetwork,
  validateSuiAddress,
} from "./utils.js";

describe("normalizeNetwork", () => {
  it("passes valid networks through", () => {
    expect(normalizeNetwork("sui:mainnet")).toBe("sui:mainnet");
    expect(normalizeNetwork("sui:testnet")).toBe("sui:testnet");
    expect(normalizeNetwork("sui:devnet")).toBe("sui:devnet");
  });

  it("throws on invalid network", () => {
    expect(() => normalizeNetwork("eip155:1")).toThrow("Unsupported Sui network");
    expect(() => normalizeNetwork("sui:localnet")).toThrow("Unsupported Sui network");
    expect(() => normalizeNetwork("")).toThrow("Unsupported Sui network");
  });
});

describe("caipToSuiNetwork", () => {
  it("maps sui:mainnet to mainnet", () => {
    expect(caipToSuiNetwork("sui:mainnet")).toBe("mainnet");
  });

  it("maps sui:testnet to testnet", () => {
    expect(caipToSuiNetwork("sui:testnet")).toBe("testnet");
  });

  it("maps sui:devnet to devnet", () => {
    expect(caipToSuiNetwork("sui:devnet")).toBe("devnet");
  });

  it("throws on unsupported network", () => {
    expect(() => caipToSuiNetwork("eip155:1")).toThrow("Unsupported Sui network");
  });
});

describe("validateSuiAddress", () => {
  it("returns true for valid 0x + 64 hex address", () => {
    const valid = `0x${"a".repeat(64)}`;
    expect(validateSuiAddress(valid)).toBe(true);
  });

  it("returns true for mixed-case hex", () => {
    const valid = `0x${"aAbBcCdDeEfF001122334455667788990011223344556677889900aAbBcCdDeEfF".slice(0, 64)}`;
    expect(validateSuiAddress(valid)).toBe(true);
  });

  it("returns false for address too short", () => {
    expect(validateSuiAddress("0xabc")).toBe(false);
  });

  it("returns false for address without 0x prefix", () => {
    expect(validateSuiAddress("a".repeat(64))).toBe(false);
  });

  it("returns false for non-hex characters", () => {
    const invalid = `0x${"g".repeat(64)}`;
    expect(validateSuiAddress(invalid)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(validateSuiAddress("")).toBe(false);
  });
});

describe("getUsdcCoinType", () => {
  it("returns mainnet USDC coin type", () => {
    expect(getUsdcCoinType("sui:mainnet")).toBe(USDC_MAINNET_COIN_TYPE);
  });

  it("returns testnet USDC coin type", () => {
    expect(getUsdcCoinType("sui:testnet")).toBe(USDC_TESTNET_COIN_TYPE);
  });

  it("returns devnet USDC coin type", () => {
    expect(getUsdcCoinType("sui:devnet")).toBe(USDC_DEVNET_COIN_TYPE);
  });

  it("throws for unsupported network", () => {
    expect(() => getUsdcCoinType("eip155:1")).toThrow("Unsupported Sui network");
  });
});

describe("convertToTokenAmount", () => {
  it("converts whole dollar amount with 6 decimals", () => {
    expect(convertToTokenAmount("1", 6)).toBe("1000000");
  });

  it("converts fractional amount", () => {
    expect(convertToTokenAmount("1.5", 6)).toBe("1500000");
  });

  it("converts small fractional amount", () => {
    expect(convertToTokenAmount("0.01", 6)).toBe("10000");
  });

  it("converts zero", () => {
    expect(convertToTokenAmount("0", 6)).toBe("0");
  });

  it("handles amount with more decimals than allowed (truncates)", () => {
    expect(convertToTokenAmount("1.1234567", 6)).toBe("1123456");
  });

  it("handles large amounts", () => {
    expect(convertToTokenAmount("1000000", 6)).toBe("1000000000000");
  });

  it("throws on invalid input", () => {
    expect(() => convertToTokenAmount("not-a-number", 6)).toThrow("Invalid amount");
  });
});
