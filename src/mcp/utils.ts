import type { PaymentPayload, PaymentRequired, SettleResponse } from "@x402/core/types";
import { MCP_PAYMENT_META_KEY, MCP_PAYMENT_RESPONSE_META_KEY } from "./types.js";

/**
 * Extract a payment payload from MCP tool _meta.
 * Returns null if no payment is present.
 */
export function extractPaymentFromMeta(meta?: Record<string, unknown>): PaymentPayload | null {
  if (!meta) return null;

  const payment = meta[MCP_PAYMENT_META_KEY];
  if (!payment || typeof payment !== "object") return null;

  return payment as PaymentPayload;
}

/**
 * Attach a settlement response to MCP tool response _meta.
 * Returns a new meta object with the payment response added.
 */
export function attachPaymentResponseToMeta(
  meta: Record<string, unknown>,
  response: SettleResponse,
): Record<string, unknown> {
  return {
    ...meta,
    [MCP_PAYMENT_RESPONSE_META_KEY]: response,
  };
}

/**
 * Create an MCP error response for payment required (402).
 * Includes the PaymentRequired details in structuredContent.
 */
export function createPaymentRequiredError(paymentRequired: PaymentRequired): {
  isError: true;
  content: Array<{ type: "text"; text: string }>;
  structuredContent: unknown;
} {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `Payment required: ${paymentRequired.error ?? "This tool requires payment"}`,
      },
    ],
    structuredContent: {
      code: 402,
      paymentRequired,
    },
  };
}
