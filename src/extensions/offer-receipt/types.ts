export const OFFER_RECEIPT = "offer-receipt";

export interface OfferPayload {
  version: string;
  resourceUrl: string;
  scheme: string;
  network: string;
  asset: string;
  payTo: string;
  amount: string;
  validUntil: string; // ISO 8601
}

export interface SignedOffer {
  format: "jws";
  signature: string; // JWS compact serialization
  payload: OfferPayload; // decoded for convenience
  acceptIndex?: number; // which accepts[] entry this offer matches
}

export interface ReceiptPayload {
  version: string;
  network: string;
  resourceUrl: string;
  payer: string;
  issuedAt: string;
  transaction?: string;
}

export interface SignedReceipt {
  format: "jws";
  signature: string;
  payload: ReceiptPayload;
}

export interface OfferReceiptDeclaration {
  includeTxHash?: boolean;
  offerValiditySeconds?: number;
}

export interface OfferReceiptIssuer {
  kid: string;
  format: "jws";
  issueOffer(payload: OfferPayload): Promise<string>; // returns JWS compact
  issueReceipt(payload: ReceiptPayload): Promise<string>; // returns JWS compact
}
