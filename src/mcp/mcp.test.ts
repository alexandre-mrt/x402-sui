import type {
  PaymentPayload,
  PaymentRequired,
  PaymentRequirements,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import { describe, expect, it, vi } from "vitest";
import { createSuiPaymentWrapper } from "./server.js";
import { MCP_PAYMENT_META_KEY, MCP_PAYMENT_RESPONSE_META_KEY } from "./types.js";
import {
  attachPaymentResponseToMeta,
  createPaymentRequiredError,
  extractPaymentFromMeta,
} from "./utils.js";

describe("extractPaymentFromMeta", () => {
  it("returns null when meta is undefined", () => {
    expect(extractPaymentFromMeta(undefined)).toBeNull();
  });

  it("returns null when meta has no payment key", () => {
    expect(extractPaymentFromMeta({ foo: "bar" })).toBeNull();
  });

  it("returns null when payment value is not an object", () => {
    expect(extractPaymentFromMeta({ [MCP_PAYMENT_META_KEY]: "not-an-object" })).toBeNull();
  });

  it("extracts payment from meta", () => {
    const payment: PaymentPayload = {
      x402Version: 1,
      accepted: {
        scheme: "exact",
        network: "sui:testnet",
        asset: "0x2::sui::SUI",
        amount: "1000000",
        payTo: "0xabc",
        maxTimeoutSeconds: 60,
        extra: {},
      },
      payload: { transaction: "base64tx", signature: "base64sig" },
    };

    const result = extractPaymentFromMeta({
      [MCP_PAYMENT_META_KEY]: payment,
    });

    expect(result).toEqual(payment);
  });
});

describe("attachPaymentResponseToMeta", () => {
  it("adds settlement response to meta", () => {
    const existingMeta = { someKey: "someValue" };
    const settleResponse: SettleResponse = {
      success: true,
      transaction: "0xtxhash",
      network: "sui:testnet",
      payer: "0xpayer",
    };

    const result = attachPaymentResponseToMeta(existingMeta, settleResponse);

    expect(result.someKey).toBe("someValue");
    expect(result[MCP_PAYMENT_RESPONSE_META_KEY]).toEqual(settleResponse);
  });

  it("preserves existing meta keys", () => {
    const meta = { a: 1, b: 2 };
    const response: SettleResponse = {
      success: true,
      transaction: "0x123",
      network: "sui:testnet",
    };

    const result = attachPaymentResponseToMeta(meta, response);
    expect(result.a).toBe(1);
    expect(result.b).toBe(2);
  });
});

describe("createPaymentRequiredError", () => {
  it("returns correct error structure", () => {
    const paymentRequired: PaymentRequired = {
      x402Version: 1,
      error: "Payment needed",
      resource: { url: "tool://search" },
      accepts: [
        {
          scheme: "exact",
          network: "sui:testnet",
          asset: "0x2::sui::SUI",
          amount: "1000000",
          payTo: "0xabc",
          maxTimeoutSeconds: 60,
          extra: {},
        },
      ],
    };

    const result = createPaymentRequiredError(paymentRequired);

    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0]?.type).toBe("text");
    expect(result.content[0]?.text).toContain("Payment required");
    expect(result.structuredContent).toEqual({
      code: 402,
      paymentRequired,
    });
  });

  it("uses default message when error is undefined", () => {
    const paymentRequired: PaymentRequired = {
      x402Version: 1,
      resource: { url: "tool://test" },
      accepts: [],
    };

    const result = createPaymentRequiredError(paymentRequired);
    expect(result.content[0]?.text).toContain("This tool requires payment");
  });
});

describe("createSuiPaymentWrapper", () => {
  const mockRequirements: PaymentRequirements = {
    scheme: "exact",
    network: "sui:testnet",
    asset: "0x2::sui::SUI",
    amount: "1000000",
    payTo: "0xabc",
    maxTimeoutSeconds: 60,
    extra: {},
  };

  const mockVerifyResponse: VerifyResponse = {
    isValid: true,
    payer: "0xpayer",
  };

  const mockSettleResponse: SettleResponse = {
    success: true,
    transaction: "0xtxhash",
    network: "sui:testnet",
    payer: "0xpayer",
  };

  function createMockResourceServer(overrides?: {
    verifyPayment?: (p: PaymentPayload, r: PaymentRequirements) => Promise<VerifyResponse>;
    settlePayment?: (p: PaymentPayload, r: PaymentRequirements) => Promise<SettleResponse>;
    findMatchingRequirements?: (
      reqs: PaymentRequirements[],
      p: PaymentPayload,
    ) => PaymentRequirements | undefined;
  }) {
    return {
      buildPaymentRequirements: vi.fn().mockResolvedValue([mockRequirements]),
      createPaymentRequiredResponse: vi.fn().mockResolvedValue({
        x402Version: 1,
        resource: { url: "tool://search" },
        accepts: [mockRequirements],
        error: "Payment required",
      }),
      verifyPayment: overrides?.verifyPayment ?? vi.fn().mockResolvedValue(mockVerifyResponse),
      settlePayment: overrides?.settlePayment ?? vi.fn().mockResolvedValue(mockSettleResponse),
      findMatchingRequirements:
        overrides?.findMatchingRequirements ?? vi.fn().mockReturnValue(mockRequirements),
    } as unknown as import("@x402/core/server").x402ResourceServer;
  }

  it("returns a function that wraps handlers", () => {
    const mockServer = createMockResourceServer();
    const wrapper = createSuiPaymentWrapper(mockServer, {
      accepts: [
        {
          scheme: "exact",
          network: "sui:testnet",
          payTo: "0xabc",
          price: 0.01,
        },
      ],
      resource: { url: "tool://search" },
    });

    expect(typeof wrapper).toBe("function");
  });

  it("returns 402 error when no payment is provided", async () => {
    const mockServer = createMockResourceServer();
    const wrapper = createSuiPaymentWrapper(mockServer, {
      accepts: [
        {
          scheme: "exact",
          network: "sui:testnet",
          payTo: "0xabc",
          price: 0.01,
        },
      ],
      resource: { url: "tool://search" },
    });

    const handler = vi.fn();
    const wrappedHandler = wrapper(handler);
    const result = await wrappedHandler({ query: "test" });

    expect(result.isError).toBe(true);
    expect(handler).not.toHaveBeenCalled();
  });

  it("executes handler and settles when payment is valid", async () => {
    const mockServer = createMockResourceServer();
    const wrapper = createSuiPaymentWrapper(mockServer, {
      accepts: [
        {
          scheme: "exact",
          network: "sui:testnet",
          payTo: "0xabc",
          price: 0.01,
        },
      ],
      resource: { url: "tool://search" },
    });

    const handler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "Search results" }],
    });

    const wrappedHandler = wrapper(handler);

    const payment: PaymentPayload = {
      x402Version: 1,
      accepted: mockRequirements,
      payload: { transaction: "base64tx", signature: "base64sig" },
    };

    const result = await wrappedHandler({
      query: "test",
      _meta: { [MCP_PAYMENT_META_KEY]: payment },
    });

    expect(handler).toHaveBeenCalled();
    expect(result.isError).toBeUndefined();
    expect(result._meta?.[MCP_PAYMENT_RESPONSE_META_KEY]).toEqual(mockSettleResponse);
  });

  it("returns error when verification fails", async () => {
    const mockServer = createMockResourceServer({
      verifyPayment: vi.fn().mockResolvedValue({
        isValid: false,
        invalidReason: "Insufficient funds",
      }),
    });

    const wrapper = createSuiPaymentWrapper(mockServer, {
      accepts: [
        {
          scheme: "exact",
          network: "sui:testnet",
          payTo: "0xabc",
          price: 0.01,
        },
      ],
      resource: { url: "tool://search" },
    });

    const handler = vi.fn();
    const wrappedHandler = wrapper(handler);

    const payment: PaymentPayload = {
      x402Version: 1,
      accepted: mockRequirements,
      payload: { transaction: "base64tx", signature: "base64sig" },
    };

    const result = await wrappedHandler({
      query: "test",
      _meta: { [MCP_PAYMENT_META_KEY]: payment },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Insufficient funds");
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns error when settlement fails", async () => {
    const mockServer = createMockResourceServer({
      settlePayment: vi.fn().mockResolvedValue({
        success: false,
        errorReason: "Settlement timeout",
        transaction: "",
        network: "sui:testnet",
      }),
    });

    const wrapper = createSuiPaymentWrapper(mockServer, {
      accepts: [
        {
          scheme: "exact",
          network: "sui:testnet",
          payTo: "0xabc",
          price: 0.01,
        },
      ],
      resource: { url: "tool://search" },
    });

    const handler = vi.fn().mockResolvedValue({
      content: [{ type: "text", text: "results" }],
    });

    const wrappedHandler = wrapper(handler);

    const payment: PaymentPayload = {
      x402Version: 1,
      accepted: mockRequirements,
      payload: { transaction: "base64tx", signature: "base64sig" },
    };

    const result = await wrappedHandler({
      query: "test",
      _meta: { [MCP_PAYMENT_META_KEY]: payment },
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Settlement timeout");
  });
});
