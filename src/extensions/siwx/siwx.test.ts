import { describe, expect, it } from "vitest";
import { formatSuiSIWxMessage } from "./message.js";
import { InMemorySIWxStorage } from "./storage.js";
import type { SIWxExtensionInfo, SIWxPayload } from "./types.js";
import { SIGN_IN_WITH_X, SIWX_HEADER } from "./types.js";

const BASE_INFO: SIWxExtensionInfo & { address: string } = {
  domain: "example.com",
  address: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  uri: "https://example.com/api/resource",
  version: "1",
  chainId: "sui:mainnet",
  type: "sui",
  nonce: "abc123",
  issuedAt: "2026-03-23T12:00:00Z",
};

describe("types", () => {
  it("exports SIGN_IN_WITH_X constant", () => {
    expect(SIGN_IN_WITH_X).toBe("sign-in-with-x");
  });

  it("exports SIWX_HEADER constant", () => {
    expect(SIWX_HEADER).toBe("x-siwx");
  });
});

describe("formatSuiSIWxMessage", () => {
  it("formats a message with all required fields", () => {
    const message = formatSuiSIWxMessage(BASE_INFO);

    expect(message).toContain("example.com wants you to sign in with your Sui account:");
    expect(message).toContain(BASE_INFO.address);
    expect(message).toContain("URI: https://example.com/api/resource");
    expect(message).toContain("Version: 1");
    expect(message).toContain("Chain ID: sui:mainnet");
    expect(message).toContain("Nonce: abc123");
    expect(message).toContain("Issued At: 2026-03-23T12:00:00Z");
  });

  it("includes statement when provided", () => {
    const message = formatSuiSIWxMessage({
      ...BASE_INFO,
      statement: "Sign in to access paid content",
    });

    expect(message).toContain("Sign in to access paid content");
  });

  it("does not include statement line when not provided", () => {
    const message = formatSuiSIWxMessage(BASE_INFO);
    const lines = message.split("\n");

    // After address line, next non-empty line should be URI
    const nonEmptyAfterAddress = lines.slice(2).filter((l) => l.trim().length > 0);
    expect(nonEmptyAfterAddress[0]).toBe("URI: https://example.com/api/resource");
  });

  it("includes expiration time when provided", () => {
    const message = formatSuiSIWxMessage({
      ...BASE_INFO,
      expirationTime: "2026-03-24T12:00:00Z",
    });

    expect(message).toContain("Expiration Time: 2026-03-24T12:00:00Z");
  });

  it("does not include expiration time when not provided", () => {
    const message = formatSuiSIWxMessage(BASE_INFO);
    expect(message).not.toContain("Expiration Time:");
  });

  it("produces CAIP-122 compliant format", () => {
    const message = formatSuiSIWxMessage({
      ...BASE_INFO,
      statement: "Please sign in",
      expirationTime: "2026-03-24T12:00:00Z",
    });

    const expected = [
      "example.com wants you to sign in with your Sui account:",
      BASE_INFO.address,
      "",
      "Please sign in",
      "",
      "URI: https://example.com/api/resource",
      "Version: 1",
      "Chain ID: sui:mainnet",
      "Nonce: abc123",
      "Issued At: 2026-03-23T12:00:00Z",
      "Expiration Time: 2026-03-24T12:00:00Z",
    ].join("\n");

    expect(message).toBe(expected);
  });
});

describe("InMemorySIWxStorage", () => {
  it("returns false for unknown resource/address", async () => {
    const storage = new InMemorySIWxStorage();
    const result = await storage.hasPaid("/resource", "0xabc");
    expect(result).toBe(false);
  });

  it("returns true after recording payment", async () => {
    const storage = new InMemorySIWxStorage();
    await storage.recordPayment("/resource", "0xabc");
    const result = await storage.hasPaid("/resource", "0xabc");
    expect(result).toBe(true);
  });

  it("isolates resources from each other", async () => {
    const storage = new InMemorySIWxStorage();
    await storage.recordPayment("/resource-a", "0xabc");

    expect(await storage.hasPaid("/resource-a", "0xabc")).toBe(true);
    expect(await storage.hasPaid("/resource-b", "0xabc")).toBe(false);
  });

  it("isolates addresses from each other", async () => {
    const storage = new InMemorySIWxStorage();
    await storage.recordPayment("/resource", "0xabc");

    expect(await storage.hasPaid("/resource", "0xabc")).toBe(true);
    expect(await storage.hasPaid("/resource", "0xdef")).toBe(false);
  });

  it("supports multiple addresses per resource", async () => {
    const storage = new InMemorySIWxStorage();
    await storage.recordPayment("/resource", "0xabc");
    await storage.recordPayment("/resource", "0xdef");

    expect(await storage.hasPaid("/resource", "0xabc")).toBe(true);
    expect(await storage.hasPaid("/resource", "0xdef")).toBe(true);
  });

  it("handles duplicate recordPayment gracefully", async () => {
    const storage = new InMemorySIWxStorage();
    await storage.recordPayment("/resource", "0xabc");
    await storage.recordPayment("/resource", "0xabc");

    expect(await storage.hasPaid("/resource", "0xabc")).toBe(true);
  });

  it("tracks nonces", async () => {
    const storage = new InMemorySIWxStorage();
    expect(await storage.hasUsedNonce("nonce-1")).toBe(false);

    await storage.recordNonce("nonce-1");
    expect(await storage.hasUsedNonce("nonce-1")).toBe(true);
    expect(await storage.hasUsedNonce("nonce-2")).toBe(false);
  });
});

describe("SIWxPayload validation", () => {
  const validPayload: SIWxPayload = {
    domain: "example.com",
    address: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    uri: "https://example.com/api/resource",
    version: "1",
    chainId: "sui:mainnet",
    type: "sui",
    nonce: "abc123",
    issuedAt: "2026-03-23T12:00:00Z",
    signature: "base64signature==",
  };

  it("has all required fields", () => {
    expect(validPayload.domain).toBeDefined();
    expect(validPayload.address).toBeDefined();
    expect(validPayload.uri).toBeDefined();
    expect(validPayload.version).toBeDefined();
    expect(validPayload.chainId).toBeDefined();
    expect(validPayload.type).toBe("sui");
    expect(validPayload.nonce).toBeDefined();
    expect(validPayload.issuedAt).toBeDefined();
    expect(validPayload.signature).toBeDefined();
  });

  it("all required fields are strings", () => {
    expect(typeof validPayload.domain).toBe("string");
    expect(typeof validPayload.address).toBe("string");
    expect(typeof validPayload.uri).toBe("string");
    expect(typeof validPayload.version).toBe("string");
    expect(typeof validPayload.chainId).toBe("string");
    expect(typeof validPayload.type).toBe("string");
    expect(typeof validPayload.nonce).toBe("string");
    expect(typeof validPayload.issuedAt).toBe("string");
    expect(typeof validPayload.signature).toBe("string");
  });

  it("optional fields can be omitted", () => {
    const minimal: SIWxPayload = {
      domain: "example.com",
      address: "0xabc",
      uri: "https://example.com",
      version: "1",
      chainId: "sui:mainnet",
      type: "sui",
      nonce: "n1",
      issuedAt: "2026-03-23T12:00:00Z",
      signature: "sig",
    };

    expect(minimal.statement).toBeUndefined();
    expect(minimal.expirationTime).toBeUndefined();
  });

  it("can be serialized and deserialized via JSON", () => {
    const json = JSON.stringify(validPayload);
    const parsed = JSON.parse(json) as SIWxPayload;

    expect(parsed).toEqual(validPayload);
  });

  it("message reconstruction produces same output for same payload", () => {
    const msg1 = formatSuiSIWxMessage(validPayload);
    const msg2 = formatSuiSIWxMessage(validPayload);
    expect(msg1).toBe(msg2);
  });
});
