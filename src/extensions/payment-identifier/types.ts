export const PAYMENT_IDENTIFIER = "payment-identifier";
export const PAYMENT_ID_MIN_LENGTH = 16;
export const PAYMENT_ID_MAX_LENGTH = 128;
export const PAYMENT_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

export interface PaymentIdentifierInfo {
  required: boolean;
}
