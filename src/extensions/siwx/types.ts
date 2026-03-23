export const SIGN_IN_WITH_X = "sign-in-with-x";

export const SIWX_HEADER = "x-siwx";

export interface SIWxExtensionInfo {
  domain: string;
  uri: string;
  statement?: string;
  version: string;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  chainId: string;
  type: "sui";
}

export interface SIWxPayload {
  domain: string;
  address: string;
  uri: string;
  version: string;
  chainId: string;
  type: "sui";
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
  statement?: string;
  signature: string;
}

export interface SIWxStorage {
  hasPaid(resource: string, address: string): Promise<boolean>;
  recordPayment(resource: string, address: string): Promise<void>;
  hasUsedNonce?(nonce: string): Promise<boolean>;
  recordNonce?(nonce: string): Promise<void>;
}
