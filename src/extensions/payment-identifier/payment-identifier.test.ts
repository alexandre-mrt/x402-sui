import { describe, expect, it } from "vitest";
import { appendPaymentIdentifierToExtensions } from "./client.js";
import { declarePaymentIdentifierExtension } from "./server.js";
import { PAYMENT_ID_MAX_LENGTH, PAYMENT_ID_MIN_LENGTH, PAYMENT_IDENTIFIER } from "./types.js";
import { generatePaymentId, isValidPaymentId } from "./utils.js";

describe("generatePaymentId", () => {
  it("returns a valid payment ID with default prefix", () => {
    const id = generatePaymentId();
    expect(id.startsWith("pay_")).toBe(true);
    expect(isValidPaymentId(id)).toBe(true);
  });

  it("uses a custom prefix when provided", () => {
    const id = generatePaymentId("order_");
    expect(id.startsWith("order_")).toBe(true);
    expect(isValidPaymentId(id)).toBe(true);
  });

  it("generates unique IDs on each call", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generatePaymentId()));
    expect(ids.size).toBe(100);
  });
});

describe("isValidPaymentId", () => {
  it("accepts a valid payment ID", () => {
    expect(isValidPaymentId("pay_abc123def456xyz7")).toBe(true);
  });

  it("rejects IDs shorter than minimum length", () => {
    expect(isValidPaymentId("short")).toBe(false);
    expect(isValidPaymentId("a".repeat(PAYMENT_ID_MIN_LENGTH - 1))).toBe(false);
  });

  it("accepts IDs at exactly minimum length", () => {
    expect(isValidPaymentId("a".repeat(PAYMENT_ID_MIN_LENGTH))).toBe(true);
  });

  it("accepts IDs at exactly maximum length", () => {
    expect(isValidPaymentId("a".repeat(PAYMENT_ID_MAX_LENGTH))).toBe(true);
  });

  it("rejects IDs longer than maximum length", () => {
    expect(isValidPaymentId("a".repeat(PAYMENT_ID_MAX_LENGTH + 1))).toBe(false);
  });

  it("rejects IDs with invalid characters", () => {
    expect(isValidPaymentId("pay_invalid chars!")).toBe(false);
    expect(isValidPaymentId("pay_with.dots.here")).toBe(false);
    expect(isValidPaymentId("pay_with@symbols")).toBe(false);
  });

  it("accepts IDs with underscores and hyphens", () => {
    expect(isValidPaymentId("pay_some-valid-id_1")).toBe(true);
  });
});

describe("declarePaymentIdentifierExtension", () => {
  it("returns correct structure with required=true", () => {
    const result = declarePaymentIdentifierExtension(true);
    expect(result).toEqual({
      [PAYMENT_IDENTIFIER]: { required: true },
    });
  });

  it("returns correct structure with required=false", () => {
    const result = declarePaymentIdentifierExtension(false);
    expect(result).toEqual({
      [PAYMENT_IDENTIFIER]: { required: false },
    });
  });

  it("defaults to required=false when not specified", () => {
    const result = declarePaymentIdentifierExtension();
    expect(result).toEqual({
      [PAYMENT_IDENTIFIER]: { required: false },
    });
  });
});

describe("appendPaymentIdentifierToExtensions", () => {
  it("adds a payment ID when server declared the extension", () => {
    const extensions: Record<string, unknown> = {};
    const paymentRequired = {
      extensions: { [PAYMENT_IDENTIFIER]: { required: true } },
    };

    const result = appendPaymentIdentifierToExtensions(extensions, paymentRequired);

    expect(result).toBeDefined();
    expect(result?.[PAYMENT_IDENTIFIER]).toBeDefined();
    const ext = result?.[PAYMENT_IDENTIFIER] as { paymentId: string };
    expect(typeof ext.paymentId).toBe("string");
    expect(isValidPaymentId(ext.paymentId)).toBe(true);
  });

  it("returns extensions unchanged when extension is not declared", () => {
    const extensions: Record<string, unknown> = { other: "data" };
    const paymentRequired = { extensions: {} };

    const result = appendPaymentIdentifierToExtensions(extensions, paymentRequired);

    expect(result).toEqual({ other: "data" });
  });

  it("returns undefined when extensions is undefined and not declared", () => {
    const paymentRequired = {};

    const result = appendPaymentIdentifierToExtensions(undefined, paymentRequired);

    expect(result).toBeUndefined();
  });

  it("preserves existing extensions when adding payment ID", () => {
    const extensions = { existing: "value" };
    const paymentRequired = {
      extensions: { [PAYMENT_IDENTIFIER]: { required: false } },
    };

    const result = appendPaymentIdentifierToExtensions(extensions, paymentRequired);

    expect(result?.existing).toBe("value");
    expect(result?.[PAYMENT_IDENTIFIER]).toBeDefined();
  });
});
