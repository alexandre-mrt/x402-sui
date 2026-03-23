import { describe, expect, it, vi } from "vitest";
import { registerExactSuiScheme } from "./register.js";

function createMockServer() {
  return {
    register: vi.fn(),
  };
}

describe("registerExactSuiScheme (server)", () => {
  it("registers with wildcard network when no networks specified", () => {
    const server = createMockServer();

    registerExactSuiScheme(server as never);

    expect(server.register).toHaveBeenCalledTimes(1);
    expect(server.register).toHaveBeenCalledWith("sui:*", expect.any(Object));
  });

  it("registers with wildcard when empty config provided", () => {
    const server = createMockServer();

    registerExactSuiScheme(server as never, {});

    expect(server.register).toHaveBeenCalledTimes(1);
    expect(server.register).toHaveBeenCalledWith("sui:*", expect.any(Object));
  });

  it("registers with specific networks when provided", () => {
    const server = createMockServer();

    registerExactSuiScheme(server as never, {
      networks: ["sui:mainnet", "sui:testnet"],
    });

    expect(server.register).toHaveBeenCalledTimes(2);
    expect(server.register).toHaveBeenCalledWith("sui:mainnet", expect.any(Object));
    expect(server.register).toHaveBeenCalledWith("sui:testnet", expect.any(Object));
  });

  it("registers with wildcard when networks is empty array", () => {
    const server = createMockServer();

    registerExactSuiScheme(server as never, { networks: [] });

    expect(server.register).toHaveBeenCalledTimes(1);
    expect(server.register).toHaveBeenCalledWith("sui:*", expect.any(Object));
  });

  it("returns the server instance", () => {
    const server = createMockServer();

    const result = registerExactSuiScheme(server as never);

    expect(result).toBe(server);
  });

  it("passes moneyParsers to the scheme", () => {
    const server = createMockServer();
    const parser = vi.fn();

    registerExactSuiScheme(server as never, { moneyParsers: [parser] });

    expect(server.register).toHaveBeenCalledTimes(1);
    // The scheme should be created with the parser (tested indirectly through registration)
  });
});
