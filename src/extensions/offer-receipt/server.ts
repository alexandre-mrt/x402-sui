import type {
  PaymentRequiredContext,
  ResourceServerExtension,
  SettleResultContext,
} from "@x402/core/types";
import { extractJWSPayload } from "./signing.js";
import type {
  OfferPayload,
  OfferReceiptDeclaration,
  OfferReceiptIssuer,
  ReceiptPayload,
  SignedOffer,
  SignedReceipt,
} from "./types.js";
import { OFFER_RECEIPT } from "./types.js";

const DEFAULT_OFFER_VALIDITY_SECONDS = 300;
const OFFER_RECEIPT_VERSION = "1";

/**
 * Create a ResourceServerExtension that signs offers and receipts using the provided issuer.
 */
export function createOfferReceiptExtension(issuer: OfferReceiptIssuer): ResourceServerExtension {
  return {
    key: OFFER_RECEIPT,

    async enrichPaymentRequiredResponse(
      declaration: unknown,
      context: PaymentRequiredContext,
    ): Promise<unknown> {
      const config = (declaration ?? {}) as OfferReceiptDeclaration;
      const validitySeconds = config.offerValiditySeconds ?? DEFAULT_OFFER_VALIDITY_SECONDS;
      const validUntil = new Date(Date.now() + validitySeconds * 1000).toISOString();
      const resourceUrl = context.resourceInfo.url;

      const offers: SignedOffer[] = [];

      for (let i = 0; i < context.requirements.length; i++) {
        const req = context.requirements[i];
        if (!req) continue;

        const offerPayload: OfferPayload = {
          version: OFFER_RECEIPT_VERSION,
          resourceUrl,
          scheme: req.scheme,
          network: req.network,
          asset: req.asset,
          payTo: req.payTo,
          amount: req.amount,
          validUntil,
        };

        const jws = await issuer.issueOffer(offerPayload);

        offers.push({
          format: "jws",
          signature: jws,
          payload: offerPayload,
          acceptIndex: i,
        });
      }

      return {
        issuer: issuer.kid,
        format: issuer.format,
        offers,
      };
    },

    async enrichSettlementResponse(
      declaration: unknown,
      context: SettleResultContext,
    ): Promise<unknown> {
      const config = (declaration ?? {}) as OfferReceiptDeclaration;
      const { result, requirements } = context;

      const receiptPayload: ReceiptPayload = {
        version: OFFER_RECEIPT_VERSION,
        network: requirements.network,
        resourceUrl: "", // will be empty if not available in settle context
        payer: result.payer ?? "",
        issuedAt: new Date().toISOString(),
        ...(config.includeTxHash ? { transaction: result.transaction } : {}),
      };

      const jws = await issuer.issueReceipt(receiptPayload);

      const receipt: SignedReceipt = {
        format: "jws",
        signature: jws,
        payload: extractJWSPayload<ReceiptPayload>(jws),
      };

      return {
        issuer: issuer.kid,
        format: issuer.format,
        receipt,
      };
    },
  };
}

/**
 * Declare the offer-receipt extension in route configuration.
 */
export function declareOfferReceiptExtension(
  config?: OfferReceiptDeclaration,
): Record<string, unknown> {
  return {
    [OFFER_RECEIPT]: config ?? {},
  };
}
