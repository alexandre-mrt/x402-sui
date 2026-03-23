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

  it("throws on case-sensitive mismatch", () => {
    expect(() => normalizeNetwork("sui:Mainnet")).toThrow("Unsupported Sui network");
    expect(() => normalizeNetwork("sui:MAINNET")).toThrow("Unsupported Sui network");
    expect(() => normalizeNetwork("SUI:mainnet")).toThrow("Unsupported Sui network");
  });

  it("throws on single colon without parts", () => {
    expect(() => normalizeNetwork(":")).toThrow("Unsupported Sui network");
  });

  it("throws on missing namespace", () => {
    expect(() => normalizeNetwork(":mainnet")).toThrow("Unsupported Sui network");
  });

  it("throws on missing reference", () => {
    expect(() => normalizeNetwork("sui:")).toThrow("Unsupported Sui network");
  });

  it("throws on whitespace-only string", () => {
    expect(() => normalizeNetwork("   ")).toThrow("Unsupported Sui network");
  });

  it("throws on network with extra colon segments", () => {
    expect(() => normalizeNetwork("sui:mainnet:extra")).toThrow("Unsupported Sui network");
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

  it("throws on empty string", () => {
    expect(() => caipToSuiNetwork("")).toThrow("Unsupported Sui network");
  });

  it("throws on case-sensitive mismatch", () => {
    expect(() => caipToSuiNetwork("sui:Mainnet")).toThrow("Unsupported Sui network");
  });

  it("throws on solana network identifier", () => {
    expect(() => caipToSuiNetwork("solana:mainnet")).toThrow("Unsupported Sui network");
  });

  it("throws on wildcard network", () => {
    expect(() => caipToSuiNetwork("sui:*")).toThrow("Unsupported Sui network");
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

  it("returns false for address that is too long (65 hex chars)", () => {
    const tooLong = `0x${"a".repeat(65)}`;
    expect(validateSuiAddress(tooLong)).toBe(false);
  });

  it("returns false for 63 hex chars (too short by one)", () => {
    const tooShort = `0x${"a".repeat(63)}`;
    expect(validateSuiAddress(tooShort)).toBe(false);
  });

  it("returns true for exactly 66 chars total (0x + 64)", () => {
    const exact = `0x${"0".repeat(64)}`;
    expect(exact.length).toBe(66);
    expect(validateSuiAddress(exact)).toBe(true);
  });

  it("returns true for uppercase hex", () => {
    const upper = `0x${"ABCDEF0123456789".repeat(4)}`;
    expect(validateSuiAddress(upper)).toBe(true);
  });

  it("returns true for lowercase hex", () => {
    const lower = `0x${"abcdef0123456789".repeat(4)}`;
    expect(validateSuiAddress(lower)).toBe(true);
  });

  it("returns false for special characters in address", () => {
    const invalid = `0x${"!@#$%^&*".repeat(8)}`;
    expect(validateSuiAddress(invalid)).toBe(false);
  });

  it("returns false for 0X prefix (uppercase X)", () => {
    const invalid = `0X${"a".repeat(64)}`;
    expect(validateSuiAddress(invalid)).toBe(false);
  });

  it("returns false for whitespace in address", () => {
    expect(validateSuiAddress(`0x${"a".repeat(32)} ${"a".repeat(31)}`)).toBe(false);
  });

  it("returns false for address with newline", () => {
    expect(validateSuiAddress(`0x${"a".repeat(32)}\n${"a".repeat(32)}`)).toBe(false);
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

  it("converts negative amount without throwing", () => {
    // parseFloat handles negative numbers; the function does not validate sign
    const result = convertToTokenAmount("-1", 6);
    expect(result).toBe("-1000000");
  });

  it("converts very large number", () => {
    expect(convertToTokenAmount("999999999", 6)).toBe("999999999000000");
  });

  it("converts amount with many decimal places (truncated to 6)", () => {
    expect(convertToTokenAmount("1.123456789012", 6)).toBe("1123456");
  });

  it("converts amount with no decimal part", () => {
    expect(convertToTokenAmount("42", 6)).toBe("42000000");
  });

  it("converts integer-only string", () => {
    expect(convertToTokenAmount("100", 6)).toBe("100000000");
  });

  it("handles scientific notation (parsed by parseFloat)", () => {
    // "1e2" is 100 in parseFloat
    expect(convertToTokenAmount("1e2", 6)).toBe("100000000");
  });

  it("throws on NaN string", () => {
    expect(() => convertToTokenAmount("NaN", 6)).toThrow("Invalid amount");
  });

  it("throws on empty string", () => {
    expect(() => convertToTokenAmount("", 6)).toThrow("Invalid amount");
  });

  it("throws on whitespace-only string", () => {
    expect(() => convertToTokenAmount("   ", 6)).toThrow("Invalid amount");
  });

  it("converts 0.000001 with 6 decimals to 1", () => {
    expect(convertToTokenAmount("0.000001", 6)).toBe("1");
  });

  it("converts with 0 decimals", () => {
    expect(convertToTokenAmount("42.99", 0)).toBe("42");
  });

  it("converts with 18 decimals", () => {
    expect(convertToTokenAmount("1", 18)).toBe("1000000000000000000");
  });

  it("handles 0.0 as zero", () => {
    expect(convertToTokenAmount("0.0", 6)).toBe("0");
  });

  it("handles leading zeros in whole part", () => {
    expect(convertToTokenAmount("001.5", 6)).toBe("1500000");
  });
});
