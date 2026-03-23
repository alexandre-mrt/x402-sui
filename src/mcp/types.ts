import type { Network } from "@x402/core/types";

export const MCP_PAYMENT_META_KEY = "x402/payment";
export const MCP_PAYMENT_RESPONSE_META_KEY = "x402/payment-response";
export const MCP_PAYMENT_REQUIRED_CODE = 402;

export interface MCPToolPaymentConfig {
  scheme: string;
  network: Network;
  payTo: string;
  price: number | string;
  description?: string;
  maxTimeoutSeconds?: number;
}
