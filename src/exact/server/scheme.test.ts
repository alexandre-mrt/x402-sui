import { describe, expect, it, vi } from "vitest";
import {
  USDC_DEVNET_COIN_TYPE,
  USDC_MAINNET_COIN_TYPE,
  USDC_TESTNET_COIN_TYPE,
} from "../../constants.js";
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

    it("converts zero price to zero amount", async () => {
      const server = new ExactSuiServerScheme();
      const result = await server.parsePrice(0, NETWORK);

      expect(result.asset).toBe(USDC_MAINNET_COIN_TYPE);
      expect(result.amount).toBe("0");
    });

    it("converts negative number", async () => {
      const server = new ExactSuiServerScheme();
      const result = await server.parsePrice(-1, NETWORK);

      // parseFloat handles negatives, convertToTokenAmount will process it
      expect(result.asset).toBe(USDC_MAINNET_COIN_TYPE);
      expect(result.amount).toBe("-1000000");
    });

    it("converts very small number (0.000001)", async () => {
      const server = new ExactSuiServerScheme();
      const result = await server.parsePrice(0.000001, NETWORK);

      expect(result.asset).toBe(USDC_MAINNET_COIN_TYPE);
      expect(result.amount).toBe("1");
    });

    it("uses correct coin type for devnet", async () => {
      const server = new ExactSuiServerScheme();
      const result = await server.parsePrice(1, "sui:devnet");

      expect(result.asset).toBe(USDC_DEVNET_COIN_TYPE);
    });

    it("uses custom MoneyParser when it returns a value", async () => {
      const customParser = vi.fn().mockResolvedValue({
        asset: "custom::coin::COIN",
        amount: "42000",
      });
      const server = new ExactSuiServerScheme([customParser]);

      const result = await server.parsePrice(42, NETWORK);

      expect(customParser).toHaveBeenCalledWith(42, NETWORK);
      expect(result.asset).toBe("custom::coin::COIN");
      expect(result.amount).toBe("42000");
    });

    it("falls back to USDC when custom MoneyParser returns null", async () => {
      const customParser = vi.fn().mockResolvedValue(null);
      const server = new ExactSuiServerScheme([customParser]);

      const result = await server.parsePrice(1, NETWORK);

      expect(customParser).toHaveBeenCalledWith(1, NETWORK);
      expect(result.asset).toBe(USDC_MAINNET_COIN_TYPE);
      expect(result.amount).toBe("1000000");
    });

    it("tries multiple parsers in order and uses first non-null result", async () => {
      const parser1 = vi.fn().mockResolvedValue(null);
      const parser2 = vi.fn().mockResolvedValue({
        asset: "second::parser::TOKEN",
        amount: "100",
      });
      const parser3 = vi.fn().mockResolvedValue({
        asset: "third::parser::TOKEN",
        amount: "200",
      });
      const server = new ExactSuiServerScheme([parser1, parser2, parser3]);

      const result = await server.parsePrice(1, NETWORK);

      expect(parser1).toHaveBeenCalled();
      expect(parser2).toHaveBeenCalled();
      expect(parser3).not.toHaveBeenCalled();
      expect(result.asset).toBe("second::parser::TOKEN");
    });

    it("converts string price through parseFloat for custom parser", async () => {
      const customParser = vi.fn().mockResolvedValue(null);
      const server = new ExactSuiServerScheme([customParser]);

      await server.parsePrice("3.14", NETWORK);

      expect(customParser).toHaveBeenCalledWith(3.14, NETWORK);
    });
  });

  describe("enhancePaymentRequirements", () => {
    it("injects gasStation from supportedKind.extra", async () => {
      const server = new ExactSuiServerScheme();
      const gasStationUrl = "https://gas.example.com/sponsor";

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
          extra: { gasStation: gasStationUrl },
        },
        [],
      );

      expect(result.extra?.gasStation).toBe(gasStationUrl);
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

    it("does not inject gasStation when not provided", async () => {
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

      expect(result.extra?.gasStation).toBeUndefined();
    });

    it("preserves existing extra fields when adding gasStation", async () => {
      const server = new ExactSuiServerScheme();
      const gasStationUrl = "https://gas.example.com/sponsor";

      const requirements = {
        scheme: "exact" as const,
        network: NETWORK,
        payTo: `0x${"11".repeat(32)}`,
        amount: "1000000",
        asset: USDC_MAINNET_COIN_TYPE,
        x402Version: 1,
        extra: { customField: "keep-me", anotherField: 42 },
      };

      const result = await server.enhancePaymentRequirements(
        requirements,
        {
          x402Version: 1,
          scheme: "exact",
          network: NETWORK,
          extra: { gasStation: gasStationUrl },
        },
        [],
      );

      expect(result.extra?.gasStation).toBe(gasStationUrl);
      expect(result.extra?.customField).toBe("keep-me");
      expect(result.extra?.anotherField).toBe(42);
    });

    it("does not inject gasStation when supportedKind has no extra", async () => {
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

      expect(result.extra).toEqual({});
    });

    it("does not inject gasStation when extra.gasStation is not a string", async () => {
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
        {
          x402Version: 1,
          scheme: "exact",
          network: NETWORK,
          extra: { gasStation: 12345 },
        },
        [],
      );

      expect(result.extra?.gasStation).toBeUndefined();
    });
  });
});
