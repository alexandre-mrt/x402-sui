import { describe, expect, it } from "vitest";
import { USDC_MAINNET_COIN_TYPE, USDC_TESTNET_COIN_TYPE } from "../../constants.js";
import { ExactSuiServerScheme } from "./scheme.js";

const NETWORK = "sui:mainnet";

describe("ExactSuiServerScheme", () => {
  describe("parsePrice", () => {
    it("converts a number input to USDC atomic units", async () => {
      const server = new ExactSuiServerScheme();
      const result = await server.parsePrice(1.5, NETWORK);

      expect(result.asset).toBe(USDC_MAINNET_COIN_TYPE);
      expect(result.amount).toBe("1500000");
    });

    it("converts a string input to USDC atomic units", async () => {
      const server = new ExactSuiServerScheme();
      const result = await server.parsePrice("0.25", NETWORK);

      expect(result.asset).toBe(USDC_MAINNET_COIN_TYPE);
      expect(result.amount).toBe("250000");
    });

    it("passes through an AssetAmount input unchanged", async () => {
      const server = new ExactSuiServerScheme();
      const input = { asset: "custom::token::TOKEN", amount: "42" };
      const result = await server.parsePrice(input, NETWORK);

      expect(result).toEqual(input);
    });

    it("uses correct coin type for testnet", async () => {
      const server = new ExactSuiServerScheme();
      const result = await server.parsePrice(1, "sui:testnet");

      expect(result.asset).toBe(USDC_TESTNET_COIN_TYPE);
    });

    it("throws on unsupported network", async () => {
      const server = new ExactSuiServerScheme();
      await expect(server.parsePrice(1, "eip155:1")).rejects.toThrow("Unsupported Sui network");
    });
  });

  describe("enhancePaymentRequirements", () => {
    it("injects gasOwner from supportedKind.extra", async () => {
      const server = new ExactSuiServerScheme();
      const gasOwnerAddress = `0x${"ab".repeat(32)}`;

      const requirements = {
        scheme: "exact" as const,
        network: NETWORK,
        payTo: `0x${"11".repeat(32)}`,
        amount: "1000000",
        asset: USDC_MAINNET_COIN_TYPE,
        x402Version: 1,
      };

      const result = await server.enhancePaymentRequirements(
        requirements,
        {
          x402Version: 1,
          scheme: "exact",
          network: NETWORK,
          extra: { gasOwner: gasOwnerAddress },
        },
        [],
      );

      expect(result.extra?.gasOwner).toBe(gasOwnerAddress);
    });

    it("preserves existing extra fields", async () => {
      const server = new ExactSuiServerScheme();

      const requirements = {
        scheme: "exact" as const,
        network: NETWORK,
        payTo: `0x${"11".repeat(32)}`,
        amount: "1000000",
        asset: USDC_MAINNET_COIN_TYPE,
        x402Version: 1,
        extra: { existingField: "value" },
      };

      const result = await server.enhancePaymentRequirements(
        requirements,
        { x402Version: 1, scheme: "exact", network: NETWORK },
        [],
      );

      expect(result.extra?.existingField).toBe("value");
    });

    it("does not inject gasOwner when not provided", async () => {
      const server = new ExactSuiServerScheme();

      const requirements = {
        scheme: "exact" as const,
        network: NETWORK,
        payTo: `0x${"11".repeat(32)}`,
        amount: "1000000",
        asset: USDC_MAINNET_COIN_TYPE,
        x402Version: 1,
      };

      const result = await server.enhancePaymentRequirements(
        requirements,
        { x402Version: 1, scheme: "exact", network: NETWORK },
        [],
      );

      expect(result.extra?.gasOwner).toBeUndefined();
    });
  });
});
