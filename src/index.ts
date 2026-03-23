// Types
export type { ExactSuiPayload } from "./types.js";
export type { ClientSuiSigner, ClientSuiConfig, FacilitatorSuiSigner } from "./signer.js";

// Constants
export {
  SUI_DEVNET_CAIP2,
  SUI_MAINNET_CAIP2,
  SUI_TESTNET_CAIP2,
  USDC_DECIMALS,
  USDC_DEVNET_COIN_TYPE,
  USDC_MAINNET_COIN_TYPE,
  USDC_TESTNET_COIN_TYPE,
} from "./constants.js";

// Utilities
export {
  convertToTokenAmount,
  createSuiClient,
  getUsdcCoinType,
  normalizeNetwork,
  validateSuiAddress,
} from "./utils.js";

// Signers
export { toClientSuiSigner, toFacilitatorSuiSigner } from "./signer.js";

// Settlement cache
export { SettlementCache } from "./settlement-cache.js";

// Token registry
export type { SuiToken } from "./tokens.js";
export { KNOWN_TOKENS, findTokenBySymbol, findTokenByCoinType } from "./tokens.js";

// Coin metadata cache
export type { CoinMetadataInfo } from "./coin-metadata.js";
export { CoinMetadataCache } from "./coin-metadata.js";

// Money parsers
export { createTokenMoneyParser, createSuiMoneyParser } from "./money-parser.js";

// Scheme implementations + registration
export { ExactSuiClientScheme, registerExactSuiClientScheme } from "./exact/client/index.js";
export type { SuiClientConfig } from "./exact/client/index.js";
export {
  ExactSuiFacilitatorScheme,
  registerExactSuiFacilitatorScheme,
} from "./exact/facilitator/index.js";
export type { SuiFacilitatorConfig } from "./exact/facilitator/index.js";
export { ExactSuiServerScheme, registerExactSuiServerScheme } from "./exact/server/index.js";
export type { SuiResourceServerConfig } from "./exact/server/index.js";

// Facilitator server
export { createFacilitatorServer } from "./facilitator/index.js";
export type { FacilitatorServerConfig } from "./facilitator/index.js";

// Extensions: Payment Identifier
export {
  PAYMENT_IDENTIFIER,
  PAYMENT_ID_MIN_LENGTH,
  PAYMENT_ID_MAX_LENGTH,
  PAYMENT_ID_PATTERN,
  generatePaymentId,
  isValidPaymentId,
  declarePaymentIdentifierExtension,
  paymentIdentifierResourceServerExtension,
  appendPaymentIdentifierToExtensions,
} from "./extensions/payment-identifier/index.js";
export type { PaymentIdentifierInfo } from "./extensions/payment-identifier/index.js";

// Extensions: Sign-In-With-X (SIWx)
export {
  SIGN_IN_WITH_X,
  SIWX_HEADER,
  formatSuiSIWxMessage,
  verifySuiSIWxSignature,
  createSIWxPayload,
  encodeSIWxHeader,
  createSIWxSettleHook,
  createSIWxRequestHook,
  InMemorySIWxStorage,
} from "./extensions/siwx/index.js";
export type {
  SIWxExtensionInfo,
  SIWxPayload,
  SIWxStorage,
  SIWxRequestResult,
  AfterSettleHook,
} from "./extensions/siwx/index.js";

// Extensions: Offer/Receipt
export {
  OFFER_RECEIPT,
  createJWS,
  extractJWSPayload,
  verifyJWS,
  createOfferReceiptExtension,
  declareOfferReceiptExtension,
  extractOffersFromPaymentRequired,
  extractReceiptFromResponse,
} from "./extensions/offer-receipt/index.js";
export type {
  OfferPayload,
  ReceiptPayload,
  SignedOffer,
  SignedReceipt,
  OfferReceiptDeclaration,
  OfferReceiptIssuer,
} from "./extensions/offer-receipt/index.js";
