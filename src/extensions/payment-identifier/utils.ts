import { PAYMENT_ID_MAX_LENGTH, PAYMENT_ID_MIN_LENGTH, PAYMENT_ID_PATTERN } from "./types.js";

const DEFAULT_PREFIX = "pay_";

export function generatePaymentId(prefix?: string): string {
  const resolvedPrefix = prefix ?? DEFAULT_PREFIX;
  const uuid = crypto.randomUUID().replace(/-/g, "");
  return `${resolvedPrefix}${uuid}`;
}

export function isValidPaymentId(id: string): boolean {
  if (id.length < PAYMENT_ID_MIN_LENGTH || id.length > PAYMENT_ID_MAX_LENGTH) {
    return false;
  }
  return PAYMENT_ID_PATTERN.test(id);
}
