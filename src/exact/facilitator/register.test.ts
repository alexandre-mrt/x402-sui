import { describe, expect, it, vi } from "vitest";
import type { FacilitatorSuiSigner } from "../../signer.js";
import { registerExactSuiScheme } from "./register.js";

const VALID_ADDRESS = `0x${"aa".repeat(32)}`;

function createMockSigner(): FacilitatorSuiSigner {
  return {
    getAddresses: vi.fn(() => [VALID_ADDRESS]),
    dryRunTransaction: vi.fn(),
    signTransaction: vi.fn(),
    executeTransaction: vi.fn(),
    waitForTransaction: vi.fn(),
  };
}

function createMockFacilitator() {
  return {
    register: vi.fn(),
  };
}

describe("registerExactSuiScheme (facilitator)", () => {
  it("registers the scheme with a single network", () => {
    const facilitator = createMockFacilitator();
    const signer = createMockSigner();

    registerExactSuiScheme(facilitator as never, {
      signer,
      networks: "sui:mainnet",
    });

    expect(facilitator.register).toHaveBeenCalledTimes(1);
    expect(facilitator.register).toHaveBeenCalledWith("sui:mainnet", expect.any(Object));
  });

  it("registers the scheme with multiple networks", () => {
    const facilitator = createMockFacilitator();
    const signer = createMockSigner();

    registerExactSuiScheme(facilitator as never, {
      signer,
      networks: ["sui:mainnet", "sui:testnet"],
    });

    expect(facilitator.register).toHaveBeenCalledTimes(1);
    expect(facilitator.register).toHaveBeenCalledWith(
      ["sui:mainnet", "sui:testnet"],
      expect.any(Object),
    );
  });

  it("returns the facilitator instance", () => {
    const facilitator = createMockFacilitator();
    const signer = createMockSigner();

    const result = registerExactSuiScheme(facilitator as never, {
      signer,
      networks: "sui:mainnet",
    });

    expect(result).toBe(facilitator);
  });
});
