import { describe, expect, it } from "vitest";
import { USDC_MAINNET_COIN_TYPE, USDC_TESTNET_COIN_TYPE } from "./constants.js";
import { findTokenByCoinType, findTokenBySymbol, KNOWN_TOKENS } from "./tokens.js";

describe("Token Registry", () => {
  describe("KNOWN_TOKENS", () => {
    it("has entries for mainnet, testnet, and devnet", () => {
      expect(KNOWN_TOKENS["sui:mainnet"]).toBeDefined();
      expect(KNOWN_TOKENS["sui:testnet"]).toBeDefined();
      expect(KNOWN_TOKENS["sui:devnet"]).toBeDefined();
    });

    it("mainnet includes USDC with correct coin type", () => {
      const usdc = KNOWN_TOKENS["sui:mainnet"]?.find((t) => t.symbol === "USDC");
      expect(usdc).toBeDefined();
      expect(usdc?.coinType).toBe(USDC_MAINNET_COIN_TYPE);
      expect(usdc?.decimals).toBe(6);
    });

    it("mainnet includes SUI with 9 decimals", () => {
      const sui = KNOWN_TOKENS["sui:mainnet"]?.find((t) => t.symbol === "SUI");
      expect(sui).toBeDefined();
      expect(sui?.coinType).toBe("0x2::sui::SUI");
      expect(sui?.decimals).toBe(9);
    });

    it("testnet includes USDC with correct coin type", () => {
      const usdc = KNOWN_TOKENS["sui:testnet"]?.find((t) => t.symbol === "USDC");
      expect(usdc).toBeDefined();
      expect(usdc?.coinType).toBe(USDC_TESTNET_COIN_TYPE);
    });
  });

  describe("findTokenBySymbol", () => {
    it("finds USDC on mainnet", () => {
      const token = findTokenBySymbol("sui:mainnet", "USDC");
      expect(token).toBeDefined();
      expect(token?.coinType).toBe(USDC_MAINNET_COIN_TYPE);
    });

    it("finds SUI on mainnet", () => {
      const token = findTokenBySymbol("sui:mainnet", "SUI");
      expect(token).toBeDefined();
      expect(token?.decimals).toBe(9);
    });

    it("is case-insensitive", () => {
      const token = findTokenBySymbol("sui:mainnet", "usdc");
      expect(token).toBeDefined();
      expect(token?.symbol).toBe("USDC");
    });

    it("returns undefined for unknown symbol", () => {
      const token = findTokenBySymbol("sui:mainnet", "UNKNOWN");
      expect(token).toBeUndefined();
    });

    it("returns undefined for unknown network", () => {
      const token = findTokenBySymbol("sui:unknown", "USDC");
      expect(token).toBeUndefined();
    });
  });

  describe("findTokenByCoinType", () => {
    it("finds USDC by coin type on mainnet", () => {
      const token = findTokenByCoinType("sui:mainnet", USDC_MAINNET_COIN_TYPE);
      expect(token).toBeDefined();
      expect(token?.symbol).toBe("USDC");
    });

    it("finds SUI by coin type", () => {
      const token = findTokenByCoinType("sui:mainnet", "0x2::sui::SUI");
      expect(token).toBeDefined();
      expect(token?.symbol).toBe("SUI");
    });

    it("returns undefined for unknown coin type", () => {
      const token = findTokenByCoinType("sui:mainnet", "0xunknown::coin::COIN");
      expect(token).toBeUndefined();
    });

    it("returns undefined for unknown network", () => {
      const token = findTokenByCoinType("sui:unknown", USDC_MAINNET_COIN_TYPE);
      expect(token).toBeUndefined();
    });
  });
});
