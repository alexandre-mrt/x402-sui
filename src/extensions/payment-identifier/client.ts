import { PAYMENT_IDENTIFIER } from "./types.js";
import { generatePaymentId } from "./utils.js";

export function appendPaymentIdentifierToExtensions(
  extensions: Record<string, unknown> | undefined,
  paymentRequired: { extensions?: Record<string, unknown> },
): Record<string, unknown> | undefined {
  const declared = paymentRequired.extensions?.[PAYMENT_IDENTIFIER];
  if (!declared) {
    return extensions;
  }

  const paymentId = generatePaymentId();
  return {
    ...extensions,
    [PAYMENT_IDENTIFIER]: { paymentId },
  };
}
