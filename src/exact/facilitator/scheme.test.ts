import { describe, expect, it, vi } from "vitest";
import { USDC_MAINNET_COIN_TYPE } from "../../constants.js";
import type { FacilitatorSuiSigner } from "../../signer.js";
import { ExactSuiFacilitatorScheme } from "./scheme.js";

const VALID_ADDRESS = `0x${"aa".repeat(32)}`;
const PAY_TO = `0x${"bb".repeat(32)}`;
const NETWORK = "sui:mainnet";

function createMockSigner(overrides: Partial<FacilitatorSuiSigner> = {}): FacilitatorSuiSigner {
  return {
    getAddresses: vi.fn(() => [VALID_ADDRESS]),
    dryRunTransaction: vi.fn(),
    executeTransaction: vi.fn(),
    waitForTransaction: vi.fn(),
    ...overrides,
  };
}

function makeRequirements(overrides: Record<string, unknown> = {}) {
  return {
    scheme: "exact" as const,
    network: NETWORK,
    payTo: PAY_TO,
    amount: "1000000",
    asset: USDC_MAINNET_COIN_TYPE,
    x402Version: 1,
    ...overrides,
  };
}

function makePayload(overrides: Record<string, unknown> = {}) {
  return {
    x402Version: 1,
    accepted: { scheme: "exact", network: NETWORK },
    payload: {
      transaction: "dHhieXRlcw==",
      signature: "c2lnbmF0dXJl",
    },
    ...overrides,
  };
}

describe("ExactSuiFacilitatorScheme", () => {
  describe("verify", () => {
    it("returns invalid when scheme is not exact", async () => {
      const signer = createMockSigner();
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const payload = makePayload({
        accepted: { scheme: "other", network: NETWORK },
      });

      const result = await scheme.verify(payload, makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("scheme_mismatch");
    });

    it("returns invalid for unsupported network", async () => {
      const signer = createMockSigner();
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.verify(makePayload(), makeRequirements({ network: "eip155:1" }));

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("unsupported_network");
    });

    it("returns invalid for invalid payTo address", async () => {
      const signer = createMockSigner();
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.verify(makePayload(), makeRequirements({ payTo: "0xinvalid" }));

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_pay_to");
    });

    it("returns invalid when payload is missing transaction or signature", async () => {
      const signer = createMockSigner();
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const payload = makePayload();
      payload.payload = { transaction: "", signature: "" };

      const result = await scheme.verify(payload, makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_payload");
    });

    it("returns valid when dry run succeeds with correct balance changes", async () => {
      const signer = createMockSigner({
        dryRunTransaction: vi.fn().mockResolvedValue({
          effects: { status: { status: "success" } },
          balanceChanges: [
            {
              owner: { AddressOwner: PAY_TO },
              coinType: USDC_MAINNET_COIN_TYPE,
              amount: "1000000",
            },
            {
              owner: { AddressOwner: VALID_ADDRESS },
              coinType: USDC_MAINNET_COIN_TYPE,
              amount: "-1000000",
            },
          ],
        }),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(true);
      expect(result.payer).toBe(VALID_ADDRESS);
    });

    it("returns invalid when dry run simulation fails", async () => {
      const signer = createMockSigner({
        dryRunTransaction: vi.fn().mockResolvedValue({
          effects: { status: { status: "failure" } },
          balanceChanges: [],
        }),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("simulation_failed");
    });

    it("returns invalid when balance changes do not match requirements", async () => {
      const signer = createMockSigner({
        dryRunTransaction: vi.fn().mockResolvedValue({
          effects: { status: { status: "success" } },
          balanceChanges: [
            {
              owner: { AddressOwner: PAY_TO },
              coinType: USDC_MAINNET_COIN_TYPE,
              amount: "500000", // less than required 1000000
            },
          ],
        }),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("insufficient_payment");
    });
  });

  describe("settle", () => {
    it("returns duplicate_settlement for repeated settlement", async () => {
      const signer = createMockSigner({
        dryRunTransaction: vi.fn().mockResolvedValue({
          effects: { status: { status: "success" } },
          balanceChanges: [
            {
              owner: { AddressOwner: PAY_TO },
              coinType: USDC_MAINNET_COIN_TYPE,
              amount: "1000000",
            },
            {
              owner: { AddressOwner: VALID_ADDRESS },
              coinType: USDC_MAINNET_COIN_TYPE,
              amount: "-1000000",
            },
          ],
        }),
        executeTransaction: vi.fn().mockResolvedValue({ digest: "txdigest123" }),
        waitForTransaction: vi.fn().mockResolvedValue({
          digest: "txdigest123",
          effects: { status: { status: "success" } },
        }),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);
      const payload = makePayload();
      const requirements = makeRequirements();

      // First settlement should succeed
      const first = await scheme.settle(payload, requirements);
      expect(first.success).toBe(true);

      // Second settlement with same payload should be duplicate
      const second = await scheme.settle(payload, requirements);
      expect(second.success).toBe(false);
      expect(second.errorReason).toBe("duplicate_settlement");
    });
  });
});
