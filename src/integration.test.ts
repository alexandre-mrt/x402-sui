/**
 * On-chain integration tests for x402-sui on Sui testnet.
 *
 * These tests execute REAL transactions on Sui testnet.
 * Requires SUI_PRIVATE_KEY env var with testnet SUI and USDC balance.
 *
 * Run with: SUI_PRIVATE_KEY=... bunx vitest run src/integration.test.ts
 */

import { getJsonRpcFullnodeUrl, SuiJsonRpcClient } from "@mysten/sui/jsonRpc";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { describe, expect, it } from "vitest";
import { USDC_TESTNET_COIN_TYPE } from "./constants.js";
import { ExactSuiClientScheme } from "./exact/client/scheme.js";
import { ExactSuiFacilitatorScheme } from "./exact/facilitator/scheme.js";
import { ExactSuiServerScheme } from "./exact/server/scheme.js";
import { createFacilitatorServer } from "./facilitator/server.js";
import { toClientSuiSigner, toFacilitatorSuiSigner } from "./signer.js";

const PRIVATE_KEY = process.env.SUI_PRIVATE_KEY;
const SHOULD_RUN = !!PRIVATE_KEY;
const NETWORK = "sui:testnet" as const;
const TIMEOUT = 30_000;

function getKeypair() {
  if (!PRIVATE_KEY) throw new Error("SUI_PRIVATE_KEY required");
  return Ed25519Keypair.fromSecretKey(PRIVATE_KEY);
}

function makeRequirements(payTo: string, amount = "10000") {
  return {
    scheme: "exact" as const,
    network: NETWORK,
    asset: USDC_TESTNET_COIN_TYPE,
    amount,
    payTo,
    maxTimeoutSeconds: 60,
    extra: {} as Record<string, unknown>,
  };
}

describe.skipIf(!SHOULD_RUN)("On-chain integration tests (Sui testnet)", () => {
  it(
    "creates a valid payment payload",
    async () => {
      const kp = getKeypair();
      const signer = toClientSuiSigner(kp);
      const client = new ExactSuiClientScheme(signer);
      const recipient = new Ed25519Keypair().toSuiAddress();

      const result = await client.createPaymentPayload(2, makeRequirements(recipient));

      expect(result.x402Version).toBe(2);
      expect(result.payload.transaction).toBeTruthy();
      expect(result.payload.signature).toBeTruthy();
    },
    TIMEOUT,
  );

  it(
    "verifies a payment via dryRun",
    async () => {
      const kp = getKeypair();
      const clientSigner = toClientSuiSigner(kp);
      const client = new ExactSuiClientScheme(clientSigner);
      const facilitatorSigner = toFacilitatorSuiSigner(kp, NETWORK);
      const facilitator = new ExactSuiFacilitatorScheme(facilitatorSigner);
      const recipient = new Ed25519Keypair().toSuiAddress();

      const requirements = makeRequirements(recipient);
      const payloadResult = await client.createPaymentPayload(2, requirements);
      const paymentPayload = {
        x402Version: 2,
        accepted: requirements,
        payload: payloadResult.payload,
      };

      const verifyResult = await facilitator.verify(paymentPayload, requirements);

      expect(verifyResult.isValid).toBe(true);
      expect(verifyResult.payer).toBe(kp.toSuiAddress());
    },
    TIMEOUT,
  );

  it(
    "settles a payment on-chain",
    async () => {
      const kp = getKeypair();
      const clientSigner = toClientSuiSigner(kp);
      const client = new ExactSuiClientScheme(clientSigner);
      const facilitatorSigner = toFacilitatorSuiSigner(kp, NETWORK);
      const facilitator = new ExactSuiFacilitatorScheme(facilitatorSigner);
      const recipient = new Ed25519Keypair().toSuiAddress();

      const requirements = makeRequirements(recipient);
      const payloadResult = await client.createPaymentPayload(2, requirements);
      const paymentPayload = {
        x402Version: 2,
        accepted: requirements,
        payload: payloadResult.payload,
      };

      const settleResult = await facilitator.settle(paymentPayload, requirements);

      expect(settleResult.success).toBe(true);
      expect(settleResult.transaction).toBeTruthy();
      expect(settleResult.payer).toBe(kp.toSuiAddress());
      expect(settleResult.network).toBe(NETWORK);

      // Verify transaction exists on-chain
      const rpcClient = new SuiJsonRpcClient({
        url: getJsonRpcFullnodeUrl("testnet"),
        network: "testnet",
      });
      const tx = await rpcClient.getTransactionBlock({
        digest: settleResult.transaction,
        options: { showEffects: true },
      });
      expect(tx.effects?.status.status).toBe("success");
    },
    TIMEOUT,
  );

  it(
    "rejects amount mismatch",
    async () => {
      const kp = getKeypair();
      const clientSigner = toClientSuiSigner(kp);
      const client = new ExactSuiClientScheme(clientSigner);
      const facilitatorSigner = toFacilitatorSuiSigner(kp, NETWORK);
      const facilitator = new ExactSuiFacilitatorScheme(facilitatorSigner);
      const recipient = new Ed25519Keypair().toSuiAddress();

      // Build payload for 0.01 USDC
      const requirements = makeRequirements(recipient, "10000");
      const payloadResult = await client.createPaymentPayload(2, requirements);
      const paymentPayload = {
        x402Version: 2,
        accepted: requirements,
        payload: payloadResult.payload,
      };

      // Verify against higher amount (0.05 USDC)
      const higherRequirements = makeRequirements(recipient, "50000");
      const verifyResult = await facilitator.verify(paymentPayload, higherRequirements);

      expect(verifyResult.isValid).toBe(false);
      expect(verifyResult.invalidReason).toBe("insufficient_payment");
    },
    TIMEOUT,
  );

  it(
    "rejects wrong recipient",
    async () => {
      const kp = getKeypair();
      const clientSigner = toClientSuiSigner(kp);
      const client = new ExactSuiClientScheme(clientSigner);
      const facilitatorSigner = toFacilitatorSuiSigner(kp, NETWORK);
      const facilitator = new ExactSuiFacilitatorScheme(facilitatorSigner);
      const recipient = new Ed25519Keypair().toSuiAddress();

      const requirements = makeRequirements(recipient);
      const payloadResult = await client.createPaymentPayload(2, requirements);
      const paymentPayload = {
        x402Version: 2,
        accepted: requirements,
        payload: payloadResult.payload,
      };

      // Verify against wrong recipient
      const wrongRecipient = new Ed25519Keypair().toSuiAddress();
      const wrongRequirements = makeRequirements(wrongRecipient);
      const verifyResult = await facilitator.verify(paymentPayload, wrongRequirements);

      expect(verifyResult.isValid).toBe(false);
      expect(verifyResult.invalidReason).toBe("insufficient_payment");
    },
    TIMEOUT,
  );

  it(
    "blocks duplicate settlement",
    async () => {
      const kp = getKeypair();
      const clientSigner = toClientSuiSigner(kp);
      const client = new ExactSuiClientScheme(clientSigner);
      const facilitatorSigner = toFacilitatorSuiSigner(kp, NETWORK);
      const facilitator = new ExactSuiFacilitatorScheme(facilitatorSigner);
      const recipient = new Ed25519Keypair().toSuiAddress();

      const requirements = makeRequirements(recipient);
      const payloadResult = await client.createPaymentPayload(2, requirements);
      const paymentPayload = {
        x402Version: 2,
        accepted: requirements,
        payload: payloadResult.payload,
      };

      // First settle succeeds
      const first = await facilitator.settle(paymentPayload, requirements);
      expect(first.success).toBe(true);

      // Second settle blocked
      const second = await facilitator.settle(paymentPayload, requirements);
      expect(second.success).toBe(false);
      expect(second.errorReason).toBe("duplicate_settlement");
    },
    TIMEOUT,
  );

  it(
    "server scheme parses price correctly",
    async () => {
      const server = new ExactSuiServerScheme();
      const result = await server.parsePrice(0.01, NETWORK);

      expect(result.asset).toBe(USDC_TESTNET_COIN_TYPE);
      expect(result.amount).toBe("10000");
    },
    TIMEOUT,
  );

  // Facilitator server test requires Bun runtime (Bun.serve).
  // Run with: SUI_PRIVATE_KEY=... bun run examples/e2e/facilitator.ts
  it.skipIf(typeof globalThis.Bun === "undefined")(
    "facilitator server responds to /supported",
    async () => {
      const kp = getKeypair();
      const facilitatorSigner = toFacilitatorSuiSigner(kp, NETWORK);
      const server = createFacilitatorServer({
        port: 4099,
        signer: facilitatorSigner,
        networks: [NETWORK],
      });

      try {
        const res = await fetch("http://localhost:4099/supported");
        const data = (await res.json()) as {
          kinds: Array<{ scheme: string; network: string }>;
          signers: Record<string, string[]>;
        };

        expect(data.kinds).toHaveLength(1);
        expect(data.kinds[0]?.scheme).toBe("exact");
        expect(data.kinds[0]?.network).toBe(NETWORK);
        expect(data.signers["sui:*"]).toContain(kp.toSuiAddress());
      } finally {
        server.stop();
      }
    },
    TIMEOUT,
  );
});
