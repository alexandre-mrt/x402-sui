import type { ResourceServerExtension } from "@x402/core/types";
import { PAYMENT_IDENTIFIER } from "./types.js";
import { generatePaymentId } from "./utils.js";

export function declarePaymentIdentifierExtension(required?: boolean): Record<string, unknown> {
  return {
    [PAYMENT_IDENTIFIER]: { required: required ?? false },
  };
}

export const paymentIdentifierResourceServerExtension: ResourceServerExtension = {
  key: PAYMENT_IDENTIFIER,
  enrichPaymentRequiredResponse: async (_declaration: unknown): Promise<unknown> => {
    const paymentId = generatePaymentId();
    return { paymentId };
  },
};
