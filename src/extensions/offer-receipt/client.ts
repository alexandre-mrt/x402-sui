import type { SignedOffer, SignedReceipt } from "./types.js";
import { OFFER_RECEIPT } from "./types.js";

interface OfferReceiptExtensionData {
  offers?: SignedOffer[];
}

interface ReceiptExtensionData {
  receipt?: SignedReceipt;
}

/**
 * Extract signed offers from a 402 PaymentRequired response's extensions.
 */
export function extractOffersFromPaymentRequired(paymentRequired: {
  extensions?: Record<string, unknown>;
}): SignedOffer[] {
  const extData = paymentRequired.extensions?.[OFFER_RECEIPT] as
    | OfferReceiptExtensionData
    | undefined;
  if (!extData?.offers || !Array.isArray(extData.offers)) {
    return [];
  }
  return extData.offers;
}

/**
 * Extract a signed receipt from settlement response extensions.
 */
export function extractReceiptFromResponse(
  extensions?: Record<string, unknown>,
): SignedReceipt | undefined {
  const extData = extensions?.[OFFER_RECEIPT] as ReceiptExtensionData | undefined;
  return extData?.receipt;
}
