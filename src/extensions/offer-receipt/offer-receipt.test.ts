import * as jose from "jose";
import { describe, expect, it } from "vitest";
import { extractOffersFromPaymentRequired, extractReceiptFromResponse } from "./client.js";
import { createOfferReceiptExtension, declareOfferReceiptExtension } from "./server.js";
import { createJWS, extractJWSPayload, verifyJWS } from "./signing.js";
import type { OfferPayload, OfferReceiptIssuer, ReceiptPayload } from "./types.js";
import { OFFER_RECEIPT } from "./types.js";

async function generateTestKeyPair() {
  return jose.generateKeyPair("ES256");
}

function createTestIssuer(privateKey: CryptoKey): OfferReceiptIssuer {
  return {
    kid: "test-key-1",
    format: "jws",
    async issueOffer(payload: OfferPayload): Promise<string> {
      return createJWS(payload as unknown as Record<string, unknown>, privateKey, "test-key-1");
    },
    async issueReceipt(payload: ReceiptPayload): Promise<string> {
      return createJWS(payload as unknown as Record<string, unknown>, privateKey, "test-key-1");
    },
  };
}

describe("JWS signing", () => {
  it("createJWS + extractJWSPayload roundtrip", async () => {
    const { privateKey } = await generateTestKeyPair();
    const payload = { foo: "bar", num: 42 };

    const jws = await createJWS(payload, privateKey, "kid-1");
    const decoded = extractJWSPayload<typeof payload>(jws);

    expect(decoded.foo).toBe("bar");
    expect(decoded.num).toBe(42);
  });

  it("verifyJWS succeeds with correct public key", async () => {
    const { privateKey, publicKey } = await generateTestKeyPair();
    const jws = await createJWS({ test: true }, privateKey, "kid-1");

    const result = await verifyJWS(jws, publicKey);
    expect(result).toBe(true);
  });

  it("verifyJWS fails with wrong public key", async () => {
    const { privateKey } = await generateTestKeyPair();
    const { publicKey: wrongKey } = await generateTestKeyPair();
    const jws = await createJWS({ test: true }, privateKey, "kid-1");

    const result = await verifyJWS(jws, wrongKey);
    expect(result).toBe(false);
  });

  it("extractJWSPayload throws on invalid JWS", () => {
    expect(() => extractJWSPayload("not-a-jws")).toThrow("Invalid JWS");
  });
});

describe("createOfferReceiptExtension", () => {
  it("creates a valid extension with correct key", async () => {
    const { privateKey } = await generateTestKeyPair();
    const issuer = createTestIssuer(privateKey);
    const extension = createOfferReceiptExtension(issuer);

    expect(extension.key).toBe(OFFER_RECEIPT);
    expect(extension.enrichPaymentRequiredResponse).toBeDefined();
    expect(extension.enrichSettlementResponse).toBeDefined();
  });

  it("enrichPaymentRequiredResponse signs offers for each requirement", async () => {
    const { privateKey, publicKey } = await generateTestKeyPair();
    const issuer = createTestIssuer(privateKey);
    const extension = createOfferReceiptExtension(issuer);

    const context = {
      requirements: [
        {
          scheme: "exact",
          network: "sui:testnet" as const,
          asset: "0xusdc",
          amount: "1000000",
          payTo: "0xrecipient",
          maxTimeoutSeconds: 300,
          extra: {},
        },
      ],
      resourceInfo: { url: "https://example.com/resource" },
      paymentRequiredResponse: {
        x402Version: 1,
        resource: { url: "https://example.com/resource" },
        accepts: [],
      },
    };

    const enrichFn = extension.enrichPaymentRequiredResponse;
    expect(enrichFn).toBeDefined();
    const result = (await enrichFn?.({}, context)) as {
      issuer: string;
      format: string;
      offers: Array<{
        format: string;
        signature: string;
        payload: OfferPayload;
        acceptIndex: number;
      }>;
    };

    expect(result.issuer).toBe("test-key-1");
    expect(result.format).toBe("jws");
    expect(result.offers).toHaveLength(1);

    const offer = result.offers[0];
    expect(offer).toBeDefined();
    expect(offer?.format).toBe("jws");
    expect(offer?.acceptIndex).toBe(0);
    expect(offer?.payload.scheme).toBe("exact");
    expect(offer?.payload.network).toBe("sui:testnet");
    expect(offer?.payload.amount).toBe("1000000");

    const verified = await verifyJWS(offer?.signature ?? "", publicKey);
    expect(verified).toBe(true);
  });

  it("enrichSettlementResponse signs a receipt", async () => {
    const { privateKey, publicKey } = await generateTestKeyPair();
    const issuer = createTestIssuer(privateKey);
    const extension = createOfferReceiptExtension(issuer);

    const context = {
      paymentPayload: {
        x402Version: 1,
        accepted: {
          scheme: "exact",
          network: "sui:testnet" as const,
          asset: "0xusdc",
          amount: "1000000",
          payTo: "0xrecipient",
          maxTimeoutSeconds: 300,
          extra: {},
        },
        payload: {},
      },
      requirements: {
        scheme: "exact",
        network: "sui:testnet" as const,
        asset: "0xusdc",
        amount: "1000000",
        payTo: "0xrecipient",
        maxTimeoutSeconds: 300,
        extra: {},
      },
      result: {
        success: true,
        payer: "0xpayer",
        transaction: "0xtxhash",
      },
    };

    const enrichFn = extension.enrichSettlementResponse;
    expect(enrichFn).toBeDefined();
    const result = (await enrichFn?.({ includeTxHash: true }, context)) as {
      receipt: { format: string; signature: string; payload: ReceiptPayload };
    };

    expect(result.receipt.format).toBe("jws");
    expect(result.receipt.payload.payer).toBe("0xpayer");
    expect(result.receipt.payload.transaction).toBe("0xtxhash");

    const verified = await verifyJWS(result.receipt.signature, publicKey);
    expect(verified).toBe(true);
  });
});

describe("declareOfferReceiptExtension", () => {
  it("returns correct structure with default config", () => {
    const result = declareOfferReceiptExtension();
    expect(result).toEqual({ [OFFER_RECEIPT]: {} });
  });

  it("returns correct structure with custom config", () => {
    const result = declareOfferReceiptExtension({
      includeTxHash: true,
      offerValiditySeconds: 600,
    });
    expect(result).toEqual({
      [OFFER_RECEIPT]: { includeTxHash: true, offerValiditySeconds: 600 },
    });
  });
});

describe("extractOffersFromPaymentRequired", () => {
  it("extracts offers from valid extension data", () => {
    const offer = {
      format: "jws" as const,
      signature: "test.sig.nature",
      payload: {
        version: "1",
        resourceUrl: "https://example.com",
        scheme: "exact",
        network: "sui:testnet",
        asset: "0xusdc",
        payTo: "0xrecipient",
        amount: "1000000",
        validUntil: new Date().toISOString(),
      },
      acceptIndex: 0,
    };

    const result = extractOffersFromPaymentRequired({
      extensions: {
        [OFFER_RECEIPT]: { offers: [offer] },
      },
    });

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(offer);
  });

  it("returns empty array when no extensions", () => {
    const result = extractOffersFromPaymentRequired({});
    expect(result).toEqual([]);
  });

  it("returns empty array when no offer-receipt extension", () => {
    const result = extractOffersFromPaymentRequired({
      extensions: { other: {} },
    });
    expect(result).toEqual([]);
  });
});

describe("extractReceiptFromResponse", () => {
  it("extracts receipt from valid extension data", () => {
    const receipt = {
      format: "jws" as const,
      signature: "test.sig.nature",
      payload: {
        version: "1",
        network: "sui:testnet",
        resourceUrl: "https://example.com",
        payer: "0xpayer",
        issuedAt: new Date().toISOString(),
        transaction: "0xtx",
      },
    };

    const result = extractReceiptFromResponse({
      [OFFER_RECEIPT]: { receipt },
    });

    expect(result).toEqual(receipt);
  });

  it("returns undefined when no extensions", () => {
    const result = extractReceiptFromResponse(undefined);
    expect(result).toBeUndefined();
  });

  it("returns undefined when no receipt in extension", () => {
    const result = extractReceiptFromResponse({
      [OFFER_RECEIPT]: {},
    });
    expect(result).toBeUndefined();
  });
});

describe("OfferPayload validation", () => {
  it("has all required fields in roundtrip", async () => {
    const { privateKey } = await generateTestKeyPair();

    const payload: OfferPayload = {
      version: "1",
      resourceUrl: "https://api.example.com/data",
      scheme: "exact",
      network: "sui:mainnet",
      asset: "0x2::sui::SUI",
      payTo: "0xrecipient_address",
      amount: "5000000",
      validUntil: "2026-12-31T23:59:59.000Z",
    };

    const jws = await createJWS(payload as unknown as Record<string, unknown>, privateKey, "kid-1");
    const decoded = extractJWSPayload<OfferPayload>(jws);

    expect(decoded.version).toBe(payload.version);
    expect(decoded.resourceUrl).toBe(payload.resourceUrl);
    expect(decoded.scheme).toBe(payload.scheme);
    expect(decoded.network).toBe(payload.network);
    expect(decoded.asset).toBe(payload.asset);
    expect(decoded.payTo).toBe(payload.payTo);
    expect(decoded.amount).toBe(payload.amount);
    expect(decoded.validUntil).toBe(payload.validUntil);
  });
});
