import type { x402ResourceServer } from "@x402/core/server";
import type { PaymentPayload, ResourceInfo } from "@x402/core/types";
import type { MCPToolPaymentConfig } from "./types.js";
import {
  attachPaymentResponseToMeta,
  createPaymentRequiredError,
  extractPaymentFromMeta,
} from "./utils.js";

export interface PaymentWrapperConfig {
  accepts: MCPToolPaymentConfig[];
  resource: ResourceInfo;
}

type MCPToolResult = {
  content: Array<{ type: string; text: string }>;
  _meta?: Record<string, unknown>;
  [key: string]: unknown;
};

type MCPToolHandler<T> = (args: T) => Promise<MCPToolResult>;

/**
 * Create a payment wrapper for MCP tool handlers on Sui.
 *
 * The returned higher-order function wraps an MCP tool handler with x402 payment logic:
 * 1. Extracts payment from args._meta["x402/payment"]
 * 2. If no payment: returns a 402 error with PaymentRequired in structuredContent
 * 3. If payment present: verifies via resourceServer.verifyPayment()
 * 4. If valid: executes the wrapped handler
 * 5. Settles via resourceServer.settlePayment()
 * 6. Attaches settlement result to response _meta["x402/payment-response"]
 */
export function createSuiPaymentWrapper(
  resourceServer: x402ResourceServer,
  config: PaymentWrapperConfig,
) {
  return function wrapTool<T>(handler: MCPToolHandler<T>) {
    return async (args: T & { _meta?: Record<string, unknown> }) => {
      const payment = extractPaymentFromMeta(args._meta);

      // No payment provided: return 402 with requirements
      if (!payment) {
        return await handleMissingPayment(resourceServer, config);
      }

      // Find matching requirements for verification
      const requirements = await buildRequirementsForPayment(resourceServer, config, payment);

      if (!requirements) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: "No matching payment requirements found for the provided payment",
            },
          ],
        };
      }

      // Verify the payment
      const verifyResult = await resourceServer.verifyPayment(payment, requirements);

      if (!verifyResult.isValid) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Payment verification failed: ${verifyResult.invalidReason ?? "unknown reason"}`,
            },
          ],
        };
      }

      // Execute the actual tool handler
      const result = await handler(args);

      // Settle the payment
      const settleResult = await resourceServer.settlePayment(payment, requirements);

      if (!settleResult.success) {
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `Payment settlement failed: ${settleResult.errorReason ?? "unknown error"}`,
            },
          ],
        };
      }

      // Attach settlement result to response meta
      const responseMeta = attachPaymentResponseToMeta(result._meta ?? {}, settleResult);

      return {
        ...result,
        _meta: responseMeta,
      };
    };
  };
}

async function handleMissingPayment(
  resourceServer: x402ResourceServer,
  config: PaymentWrapperConfig,
) {
  const allRequirements = [];

  for (const accept of config.accepts) {
    const reqs = await resourceServer.buildPaymentRequirements({
      scheme: accept.scheme,
      network: accept.network,
      payTo: accept.payTo,
      price: accept.price,
      maxTimeoutSeconds: accept.maxTimeoutSeconds,
    });
    allRequirements.push(...reqs);
  }

  const paymentRequired = await resourceServer.createPaymentRequiredResponse(
    allRequirements,
    config.resource,
    "Payment required to access this tool",
  );

  return createPaymentRequiredError(paymentRequired);
}

async function buildRequirementsForPayment(
  resourceServer: x402ResourceServer,
  config: PaymentWrapperConfig,
  payment: PaymentPayload,
) {
  const allRequirements = [];

  for (const accept of config.accepts) {
    const reqs = await resourceServer.buildPaymentRequirements({
      scheme: accept.scheme,
      network: accept.network,
      payTo: accept.payTo,
      price: accept.price,
      maxTimeoutSeconds: accept.maxTimeoutSeconds,
    });
    allRequirements.push(...reqs);
  }

  return resourceServer.findMatchingRequirements(allRequirements, payment);
}
