import { describe, expect, it, vi } from "vitest";
import type { ClientSuiSigner } from "../../signer.js";
import { registerExactSuiScheme } from "./register.js";

const VALID_ADDRESS = `0x${"aa".repeat(32)}`;

function createMockSigner(): ClientSuiSigner {
  return {
    address: VALID_ADDRESS,
    signTransaction: vi.fn(),
  };
}

function createMockClient() {
  return {
    register: vi.fn(),
    registerPolicy: vi.fn(),
  };
}

describe("registerExactSuiScheme (client)", () => {
  it("registers with wildcard network when no networks specified", () => {
    const client = createMockClient();
    const signer = createMockSigner();

    registerExactSuiScheme(client as never, { signer });

    expect(client.register).toHaveBeenCalledTimes(1);
    expect(client.register).toHaveBeenCalledWith("sui:*", expect.any(Object));
  });

  it("registers with specific networks when provided", () => {
    const client = createMockClient();
    const signer = createMockSigner();

    registerExactSuiScheme(client as never, {
      signer,
      networks: ["sui:mainnet", "sui:testnet"],
    });

    expect(client.register).toHaveBeenCalledTimes(2);
    expect(client.register).toHaveBeenCalledWith("sui:mainnet", expect.any(Object));
    expect(client.register).toHaveBeenCalledWith("sui:testnet", expect.any(Object));
  });

  it("registers with wildcard when networks is empty array", () => {
    const client = createMockClient();
    const signer = createMockSigner();

    registerExactSuiScheme(client as never, {
      signer,
      networks: [],
    });

    expect(client.register).toHaveBeenCalledTimes(1);
    expect(client.register).toHaveBeenCalledWith("sui:*", expect.any(Object));
  });

  it("applies policies when provided", () => {
    const client = createMockClient();
    const signer = createMockSigner();
    const policy1 = vi.fn();
    const policy2 = vi.fn();

    registerExactSuiScheme(client as never, {
      signer,
      policies: [policy1 as never, policy2 as never],
    });

    expect(client.registerPolicy).toHaveBeenCalledTimes(2);
    expect(client.registerPolicy).toHaveBeenCalledWith(policy1);
    expect(client.registerPolicy).toHaveBeenCalledWith(policy2);
  });

  it("does not register policies when none provided", () => {
    const client = createMockClient();
    const signer = createMockSigner();

    registerExactSuiScheme(client as never, { signer });

    expect(client.registerPolicy).not.toHaveBeenCalled();
  });

  it("returns the client instance", () => {
    const client = createMockClient();
    const signer = createMockSigner();

    const result = registerExactSuiScheme(client as never, { signer });

    expect(result).toBe(client);
  });

  it("passes rpcUrl through to the scheme", () => {
    const client = createMockClient();
    const signer = createMockSigner();

    // This should not throw even with custom RPC URL
    registerExactSuiScheme(client as never, {
      signer,
      rpcUrl: "https://custom-rpc.example.com",
    });

    expect(client.register).toHaveBeenCalledTimes(1);
  });
});
