import { describe, expect, it, vi } from "vitest";
import type { ClientSuiSigner } from "../../signer.js";
import { ExactSuiClientScheme } from "./scheme.js";

// Mock the utils module to avoid real RPC calls
vi.mock("../../utils.js", () => ({
  createSuiClient: vi.fn(() => ({
    getCoins: vi.fn(),
  })),
  caipToSuiNetwork: vi.fn(() => "mainnet"),
  normalizeNetwork: vi.fn((n: string) => n),
  getUsdcCoinType: vi.fn(() => "0xusdc::usdc::USDC"),
  validateSuiAddress: vi.fn(() => true),
}));

let mockTxInstance: Record<string, ReturnType<typeof vi.fn>>;

// Mock @mysten/sui/transactions
vi.mock("@mysten/sui/transactions", () => {
  const createMockTx = () => ({
    setSender: vi.fn(),
    setGasBudget: vi.fn(),
    setGasOwner: vi.fn(),
    object: vi.fn((id: string) => ({ id })),
    mergeCoins: vi.fn(),
    splitCoins: vi.fn(() => "splitResult"),
    transferObjects: vi.fn(),
    build: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
  });

  class MockTransaction {
    setSender: ReturnType<typeof vi.fn>;
    setGasBudget: ReturnType<typeof vi.fn>;
    setGasOwner: ReturnType<typeof vi.fn>;
    object: ReturnType<typeof vi.fn>;
    mergeCoins: ReturnType<typeof vi.fn>;
    splitCoins: ReturnType<typeof vi.fn>;
    transferObjects: ReturnType<typeof vi.fn>;
    build: ReturnType<typeof vi.fn>;

    constructor() {
      const mock = createMockTx();
      this.setSender = mock.setSender;
      this.setGasBudget = mock.setGasBudget;
      this.setGasOwner = mock.setGasOwner;
      this.object = mock.object;
      this.mergeCoins = mock.mergeCoins;
      this.splitCoins = mock.splitCoins;
      this.transferObjects = mock.transferObjects;
      this.build = mock.build;
      // Store reference for assertions
      mockTxInstance = this as unknown as Record<string, ReturnType<typeof vi.fn>>;
    }
  }

  return { Transaction: MockTransaction };
});

const { createSuiClient } = await import("../../utils.js");

const VALID_ADDRESS = `0x${"aa".repeat(32)}`;
const PAY_TO = `0x${"bb".repeat(32)}`;
const USDC_COIN_TYPE = "0xusdc::usdc::USDC";
const NETWORK = "sui:mainnet";

function createMockSigner(overrides: Partial<ClientSuiSigner> = {}): ClientSuiSigner {
  return {
    address: VALID_ADDRESS,
    signTransaction: vi.fn().mockResolvedValue({
      signature: "test-signature",
      bytes: "dHhieXRlcw==",
    }),
    ...overrides,
  };
}

function makeRequirements(overrides: Record<string, unknown> = {}) {
  return {
    scheme: "exact" as const,
    network: NETWORK,
    payTo: PAY_TO,
    amount: "1000000",
    asset: USDC_COIN_TYPE,
    x402Version: 1,
    ...overrides,
  };
}

describe("ExactSuiClientScheme", () => {
  it("has scheme set to exact", () => {
    const signer = createMockSigner();
    const scheme = new ExactSuiClientScheme(signer);
    expect(scheme.scheme).toBe("exact");
  });

  describe("createPaymentPayload", () => {
    it("builds correct transaction with single coin", async () => {
      const mockGetCoins = vi.fn().mockResolvedValue({
        data: [{ coinObjectId: "coin-1", balance: "5000000" }],
      });
      vi.mocked(createSuiClient).mockReturnValue({ getCoins: mockGetCoins } as never);

      const signer = createMockSigner();
      const scheme = new ExactSuiClientScheme(signer);

      const result = await scheme.createPaymentPayload(1, makeRequirements());

      expect(result.x402Version).toBe(1);
      expect(result.payload).toHaveProperty("transaction");
      expect(result.payload).toHaveProperty("signature");
      expect(signer.signTransaction).toHaveBeenCalled();
    });

    it("merges multiple coins before splitting", async () => {
      const mockGetCoins = vi.fn().mockResolvedValue({
        data: [
          { coinObjectId: "coin-1", balance: "500000" },
          { coinObjectId: "coin-2", balance: "500000" },
          { coinObjectId: "coin-3", balance: "200000" },
        ],
      });
      vi.mocked(createSuiClient).mockReturnValue({ getCoins: mockGetCoins } as never);

      const signer = createMockSigner();
      const scheme = new ExactSuiClientScheme(signer);

      const result = await scheme.createPaymentPayload(1, makeRequirements());

      expect(mockTxInstance.mergeCoins).toHaveBeenCalled();
      expect(result.payload).toHaveProperty("transaction");
    });

    it("throws when no coins are found", async () => {
      const mockGetCoins = vi.fn().mockResolvedValue({ data: [] });
      vi.mocked(createSuiClient).mockReturnValue({ getCoins: mockGetCoins } as never);

      const signer = createMockSigner();
      const scheme = new ExactSuiClientScheme(signer);

      await expect(scheme.createPaymentPayload(1, makeRequirements())).rejects.toThrow(
        /No.*coins found/,
      );
    });

    it("sets gas budget when specified in requirements.extra", async () => {
      const mockGetCoins = vi.fn().mockResolvedValue({
        data: [{ coinObjectId: "coin-1", balance: "5000000" }],
      });
      vi.mocked(createSuiClient).mockReturnValue({ getCoins: mockGetCoins } as never);

      const signer = createMockSigner();
      const scheme = new ExactSuiClientScheme(signer);

      await scheme.createPaymentPayload(1, makeRequirements({ extra: { gasBudget: 50000 } }));

      expect(mockTxInstance.setGasBudget).toHaveBeenCalledWith(BigInt(50000));
    });

    it("sets gas owner when specified in requirements.extra", async () => {
      const mockGetCoins = vi.fn().mockResolvedValue({
        data: [{ coinObjectId: "coin-1", balance: "5000000" }],
      });
      vi.mocked(createSuiClient).mockReturnValue({ getCoins: mockGetCoins } as never);

      const gasOwner = `0x${"cc".repeat(32)}`;
      const signer = createMockSigner();
      const scheme = new ExactSuiClientScheme(signer);

      await scheme.createPaymentPayload(1, makeRequirements({ extra: { gasOwner } }));

      expect(mockTxInstance.setGasOwner).toHaveBeenCalledWith(gasOwner);
    });

    it("does not set gas budget when extra is undefined", async () => {
      const mockGetCoins = vi.fn().mockResolvedValue({
        data: [{ coinObjectId: "coin-1", balance: "5000000" }],
      });
      vi.mocked(createSuiClient).mockReturnValue({ getCoins: mockGetCoins } as never);

      const signer = createMockSigner();
      const scheme = new ExactSuiClientScheme(signer);

      await scheme.createPaymentPayload(1, makeRequirements());

      expect(mockTxInstance.setGasBudget).not.toHaveBeenCalled();
    });

    it("does not set gas owner when extra is undefined", async () => {
      const mockGetCoins = vi.fn().mockResolvedValue({
        data: [{ coinObjectId: "coin-1", balance: "5000000" }],
      });
      vi.mocked(createSuiClient).mockReturnValue({ getCoins: mockGetCoins } as never);

      const signer = createMockSigner();
      const scheme = new ExactSuiClientScheme(signer);

      await scheme.createPaymentPayload(1, makeRequirements());

      expect(mockTxInstance.setGasOwner).not.toHaveBeenCalled();
    });

    it("sets gas budget from string value", async () => {
      const mockGetCoins = vi.fn().mockResolvedValue({
        data: [{ coinObjectId: "coin-1", balance: "5000000" }],
      });
      vi.mocked(createSuiClient).mockReturnValue({ getCoins: mockGetCoins } as never);

      const signer = createMockSigner();
      const scheme = new ExactSuiClientScheme(signer);

      await scheme.createPaymentPayload(1, makeRequirements({ extra: { gasBudget: "100000" } }));

      expect(mockTxInstance.setGasBudget).toHaveBeenCalledWith(BigInt("100000"));
    });

    it("returns correct x402Version in result", async () => {
      const mockGetCoins = vi.fn().mockResolvedValue({
        data: [{ coinObjectId: "coin-1", balance: "5000000" }],
      });
      vi.mocked(createSuiClient).mockReturnValue({ getCoins: mockGetCoins } as never);

      const signer = createMockSigner();
      const scheme = new ExactSuiClientScheme(signer);

      const result = await scheme.createPaymentPayload(2, makeRequirements());

      expect(result.x402Version).toBe(2);
    });

    it("does not merge coins when only one coin is available", async () => {
      const mockGetCoins = vi.fn().mockResolvedValue({
        data: [{ coinObjectId: "single-coin", balance: "5000000" }],
      });
      vi.mocked(createSuiClient).mockReturnValue({ getCoins: mockGetCoins } as never);

      const signer = createMockSigner();
      const scheme = new ExactSuiClientScheme(signer);

      await scheme.createPaymentPayload(1, makeRequirements());

      expect(mockTxInstance.mergeCoins).not.toHaveBeenCalled();
    });
  });
});
