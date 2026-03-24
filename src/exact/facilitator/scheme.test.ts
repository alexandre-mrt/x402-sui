import { describe, expect, it, vi } from "vitest";
import { USDC_MAINNET_COIN_TYPE, USDC_TESTNET_COIN_TYPE } from "../../constants.js";
import type { FacilitatorSuiSigner } from "../../signer.js";
import { ExactSuiFacilitatorScheme } from "./scheme.js";

const VALID_ADDRESS = `0x${"aa".repeat(32)}`;

// Mock @mysten/sui/verify to avoid needing real crypto in unit tests
vi.mock("@mysten/sui/verify", () => ({
  verifyTransactionSignature: vi.fn().mockResolvedValue({
    toSuiAddress: () => VALID_ADDRESS,
  }),
}));
const PAY_TO = `0x${"bb".repeat(32)}`;
const GAS_STATION_URL = "https://gas.example.com/sponsor";
const NETWORK = "sui:mainnet";

function createMockSigner(overrides: Partial<FacilitatorSuiSigner> = {}): FacilitatorSuiSigner {
  return {
    getAddresses: vi.fn(() => [VALID_ADDRESS]),
    dryRunTransaction: vi.fn(),
    signTransaction: vi.fn().mockResolvedValue({ signature: "facilitator-sig", bytes: "bytes" }),
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

function successDryRun(amount = "1000000") {
  return vi.fn().mockResolvedValue({
    effects: { status: { status: "success" } },
    balanceChanges: [
      {
        owner: { AddressOwner: PAY_TO },
        coinType: USDC_MAINNET_COIN_TYPE,
        amount,
      },
      {
        owner: { AddressOwner: VALID_ADDRESS },
        coinType: USDC_MAINNET_COIN_TYPE,
        amount: `-${amount}`,
      },
    ],
  });
}

describe("ExactSuiFacilitatorScheme", () => {
  describe("getExtra", () => {
    it("returns gasStation URL when configured", () => {
      const signer = createMockSigner();
      const scheme = new ExactSuiFacilitatorScheme(signer, undefined, {
        gasStationUrl: "https://gas.example.com/sponsor",
      });
      const extra = scheme.getExtra(NETWORK);
      expect(extra).toHaveProperty("gasStation", "https://gas.example.com/sponsor");
    });

    it("returns undefined when no gasStation configured", () => {
      const signer = createMockSigner();
      const scheme = new ExactSuiFacilitatorScheme(signer);
      const extra = scheme.getExtra(NETWORK);
      expect(extra).toBeUndefined();
    });

    it("returns undefined when signer has no addresses", () => {
      const signer = createMockSigner({ getAddresses: vi.fn(() => []) });
      const scheme = new ExactSuiFacilitatorScheme(signer);
      expect(scheme.getExtra(NETWORK)).toBeUndefined();
    });
  });

  describe("getSigners", () => {
    it("returns signer addresses", () => {
      const signer = createMockSigner();
      const scheme = new ExactSuiFacilitatorScheme(signer);
      expect(scheme.getSigners(NETWORK)).toEqual([VALID_ADDRESS]);
    });
  });

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
        dryRunTransaction: successDryRun(),
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

    // --- Edge cases ---

    it("rejects zero amount (no payer identifiable)", async () => {
      const signer = createMockSigner({
        dryRunTransaction: vi.fn().mockResolvedValue({
          effects: { status: { status: "success" } },
          balanceChanges: [
            {
              owner: { AddressOwner: PAY_TO },
              coinType: USDC_MAINNET_COIN_TYPE,
              amount: "0",
            },
          ],
        }),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.verify(makePayload(), makeRequirements({ amount: "0" }));

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("payer_not_found");
    });

    it("rejects overpayment (strict exact amount per spec)", async () => {
      const signer = createMockSigner({
        dryRunTransaction: vi.fn().mockResolvedValue({
          effects: { status: { status: "success" } },
          balanceChanges: [
            {
              owner: { AddressOwner: PAY_TO },
              coinType: USDC_MAINNET_COIN_TYPE,
              amount: "2000000", // more than required 1000000
            },
            {
              owner: { AddressOwner: VALID_ADDRESS },
              coinType: USDC_MAINNET_COIN_TYPE,
              amount: "-2000000",
            },
          ],
        }),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("insufficient_payment");
    });

    it("returns invalid when coin type does not match", async () => {
      const signer = createMockSigner({
        dryRunTransaction: vi.fn().mockResolvedValue({
          effects: { status: { status: "success" } },
          balanceChanges: [
            {
              owner: { AddressOwner: PAY_TO },
              coinType: USDC_TESTNET_COIN_TYPE, // wrong coin type
              amount: "1000000",
            },
          ],
        }),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("insufficient_payment");
    });

    it("returns invalid when transaction is empty string in payload", async () => {
      const signer = createMockSigner();
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const payload = makePayload();
      payload.payload = { transaction: "", signature: "c2lnbmF0dXJl" };

      const result = await scheme.verify(payload, makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_payload");
    });

    it("returns invalid when signature is empty string in payload", async () => {
      const signer = createMockSigner();
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const payload = makePayload();
      payload.payload = { transaction: "dHhieXRlcw==", signature: "" };

      const result = await scheme.verify(payload, makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("invalid_payload");
    });

    it("returns verification_error when dryRun throws exception", async () => {
      const signer = createMockSigner({
        dryRunTransaction: vi.fn().mockRejectedValue(new Error("RPC connection failed")),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("verification_error");
      expect(result.invalidMessage).toBe("RPC connection failed");
    });

    it("rejects transactions with unexpected third-party balance changes (PTB injection)", async () => {
      const thirdParty = `0x${"cc".repeat(32)}`;
      const signer = createMockSigner({
        dryRunTransaction: vi.fn().mockResolvedValue({
          effects: { status: { status: "success" } },
          balanceChanges: [
            {
              owner: { AddressOwner: thirdParty },
              coinType: USDC_MAINNET_COIN_TYPE,
              amount: "500000", // unexpected: third party receives funds
            },
            {
              owner: { AddressOwner: PAY_TO },
              coinType: USDC_MAINNET_COIN_TYPE,
              amount: "1000000",
            },
            {
              owner: { AddressOwner: VALID_ADDRESS },
              coinType: USDC_MAINNET_COIN_TYPE,
              amount: "-1500000",
            },
          ],
        }),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("unexpected_side_effects");
    });

    it("ignores balance changes with ObjectOwner (not AddressOwner)", async () => {
      const signer = createMockSigner({
        dryRunTransaction: vi.fn().mockResolvedValue({
          effects: { status: { status: "success" } },
          balanceChanges: [
            {
              owner: { ObjectOwner: PAY_TO }, // ObjectOwner, not AddressOwner
              coinType: USDC_MAINNET_COIN_TYPE,
              amount: "1000000",
            },
          ],
        }),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("insufficient_payment");
    });

    it("returns valid with very large amount (no overflow with BigInt)", async () => {
      const largeAmount = "999999999999999999999";
      const signer = createMockSigner({
        dryRunTransaction: vi.fn().mockResolvedValue({
          effects: { status: { status: "success" } },
          balanceChanges: [
            {
              owner: { AddressOwner: PAY_TO },
              coinType: USDC_MAINNET_COIN_TYPE,
              amount: largeAmount,
            },
            {
              owner: { AddressOwner: VALID_ADDRESS },
              coinType: USDC_MAINNET_COIN_TYPE,
              amount: `-${largeAmount}`,
            },
          ],
        }),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.verify(makePayload(), makeRequirements({ amount: largeAmount }));

      expect(result.isValid).toBe(true);
    });

    it("rejects when payer cannot be identified (no negative balance change)", async () => {
      const signer = createMockSigner({
        dryRunTransaction: vi.fn().mockResolvedValue({
          effects: { status: { status: "success" } },
          balanceChanges: [
            {
              owner: { AddressOwner: PAY_TO },
              coinType: USDC_MAINNET_COIN_TYPE,
              amount: "1000000",
            },
          ],
        }),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.verify(makePayload(), makeRequirements());

      expect(result.isValid).toBe(false);
      expect(result.invalidReason).toBe("payer_not_found");
    });
  });

  describe("settle", () => {
    it("returns duplicate_settlement for repeated settlement", async () => {
      const signer = createMockSigner({
        dryRunTransaction: successDryRun(),
        executeTransaction: vi.fn().mockResolvedValue({ digest: "txdigest123" }),
        waitForTransaction: vi.fn().mockResolvedValue({
          digest: "txdigest123",
          effects: { status: { status: "success" } },
        }),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);
      const payload = makePayload();
      const requirements = makeRequirements();

      const first = await scheme.settle(payload, requirements);
      expect(first.success).toBe(true);

      const second = await scheme.settle(payload, requirements);
      expect(second.success).toBe(false);
      expect(second.errorReason).toBe("duplicate_settlement");
    });

    it("returns failure when verification fails", async () => {
      const signer = createMockSigner({
        dryRunTransaction: vi.fn().mockResolvedValue({
          effects: { status: { status: "failure" } },
          balanceChanges: [],
        }),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.settle(makePayload(), makeRequirements());

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("simulation_failed");
    });

    it("co-signs as gas sponsor when gasStationUrl is configured", async () => {
      const signFn = vi.fn().mockResolvedValue({ signature: "facilitator-sig", bytes: "bytes" });
      const executeFn = vi.fn().mockResolvedValue({ digest: "txdigest-gas" });
      const signer = createMockSigner({
        dryRunTransaction: successDryRun(),
        signTransaction: signFn,
        executeTransaction: executeFn,
        waitForTransaction: vi.fn().mockResolvedValue({
          digest: "txdigest-gas",
          effects: { status: { status: "success" } },
        }),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer, undefined, {
        gasStationUrl: GAS_STATION_URL,
      });

      const requirements = makeRequirements();

      const result = await scheme.settle(makePayload(), requirements);

      expect(result.success).toBe(true);
      // Should have called signTransaction for co-signing
      expect(signFn).toHaveBeenCalled();
      // Should execute with 2 signatures (client + facilitator)
      expect(executeFn).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(["c2lnbmF0dXJl", "facilitator-sig"]),
      );
    });

    it("executes with single signature when no gasStation", async () => {
      const executeFn = vi.fn().mockResolvedValue({ digest: "txdigest" });
      const signer = createMockSigner({
        dryRunTransaction: successDryRun(),
        executeTransaction: executeFn,
        waitForTransaction: vi.fn().mockResolvedValue({
          digest: "txdigest",
          effects: { status: { status: "success" } },
        }),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.settle(makePayload(), makeRequirements());

      expect(result.success).toBe(true);
      // Only client signature
      expect(executeFn).toHaveBeenCalledWith("dHhieXRlcw==", ["c2lnbmF0dXJl"]);
    });

    it("returns settlement_error when signTransaction fails", async () => {
      const signer = createMockSigner({
        dryRunTransaction: successDryRun(),
        signTransaction: vi.fn().mockRejectedValue(new Error("Signing failed")),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer, undefined, {
        gasStationUrl: GAS_STATION_URL,
      });

      const requirements = makeRequirements();

      const result = await scheme.settle(makePayload(), requirements);

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("settlement_error");
      expect(result.errorMessage).toBe("Signing failed");
    });

    it("returns settlement_error when executeTransaction fails", async () => {
      const signer = createMockSigner({
        dryRunTransaction: successDryRun(),
        executeTransaction: vi.fn().mockRejectedValue(new Error("Execution failed")),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.settle(makePayload(), makeRequirements());

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("settlement_error");
      expect(result.errorMessage).toBe("Execution failed");
    });

    it("returns settlement_error when waitForTransaction times out", async () => {
      const signer = createMockSigner({
        dryRunTransaction: successDryRun(),
        executeTransaction: vi.fn().mockResolvedValue({ digest: "txdigest" }),
        waitForTransaction: vi.fn().mockRejectedValue(new Error("Transaction timeout")),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.settle(makePayload(), makeRequirements());

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("settlement_error");
      expect(result.errorMessage).toBe("Transaction timeout");
    });

    it("returns execution_failed when transaction status is not success", async () => {
      const signer = createMockSigner({
        dryRunTransaction: successDryRun(),
        executeTransaction: vi.fn().mockResolvedValue({ digest: "txdigest" }),
        waitForTransaction: vi.fn().mockResolvedValue({
          digest: "txdigest",
          effects: { status: { status: "failure" } },
        }),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.settle(makePayload(), makeRequirements());

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("execution_failed");
      expect(result.errorMessage).toContain("failure");
      expect(result.transaction).toBe("txdigest");
    });

    it("returns correct network in settle response", async () => {
      const signer = createMockSigner({
        dryRunTransaction: successDryRun(),
        executeTransaction: vi.fn().mockResolvedValue({ digest: "txdigest" }),
        waitForTransaction: vi.fn().mockResolvedValue({
          digest: "txdigest",
          effects: { status: { status: "success" } },
        }),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.settle(makePayload(), makeRequirements());

      expect(result.network).toBe(NETWORK);
    });

    it("handles non-Error exceptions in settle", async () => {
      const signer = createMockSigner({
        dryRunTransaction: successDryRun(),
        executeTransaction: vi.fn().mockRejectedValue("string error"),
      });
      const scheme = new ExactSuiFacilitatorScheme(signer);

      const result = await scheme.settle(makePayload(), makeRequirements());

      expect(result.success).toBe(false);
      expect(result.errorReason).toBe("settlement_error");
      expect(result.errorMessage).toBe("Unknown settlement error");
    });
  });
});
