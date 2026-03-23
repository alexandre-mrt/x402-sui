/**
 * x402-sui E2E Example: Client
 *
 * Makes a paid request to the resource server.
 * Handles the 402 Payment Required flow manually:
 *   1. Sends GET to the protected endpoint
 *   2. Receives 402 with payment requirements
 *   3. Creates and signs a USDC payment transaction
 *   4. Retries the request with the payment header
 *
 * Usage:
 *   SUI_PRIVATE_KEY=... bun run examples/e2e/client.ts
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { PaymentPayload, PaymentRequired } from "@x402/core/types";
import { ExactSuiClientScheme } from "../../src/exact/client/scheme.js";
import { toClientSuiSigner } from "../../src/signer.js";

const SERVER_URL = process.env.SERVER_URL ?? "http://localhost:4020";
const RESOURCE_PATH = "/api/premium-data";

const PAYMENT_HEADER = "x-payment";
const PAYMENT_REQUIRED_HEADER = "x-payment-required";

const privateKey = process.env.SUI_PRIVATE_KEY;
if (!privateKey) {
  console.error("Error: SUI_PRIVATE_KEY environment variable is required");
  process.exit(1);
}

const keypair = Ed25519Keypair.fromSecretKey(privateKey);
const clientSigner = toClientSuiSigner(keypair);
const clientScheme = new ExactSuiClientScheme(clientSigner);

console.log(`Client address: ${keypair.toSuiAddress()}`);
console.log(`Target: ${SERVER_URL}${RESOURCE_PATH}`);
console.log();

// Step 1: Request the protected resource (expect 402)
console.log("Step 1: Requesting protected resource...");
const initialResponse = await fetch(`${SERVER_URL}${RESOURCE_PATH}`);

if (initialResponse.status !== 402) {
  console.log(`Unexpected status: ${initialResponse.status}`);
  const body = await initialResponse.text();
  console.log("Response:", body);
  process.exit(1);
}

// Step 2: Parse payment requirements
console.log("Step 2: Received 402 Payment Required");

let paymentRequired: PaymentRequired;
const encodedHeader = initialResponse.headers.get(PAYMENT_REQUIRED_HEADER);

if (encodedHeader) {
  paymentRequired = JSON.parse(
    Buffer.from(encodedHeader, "base64").toString("utf-8"),
  ) as PaymentRequired;
} else {
  paymentRequired = (await initialResponse.json()) as PaymentRequired;
}

const requirements = paymentRequired.accepts[0];
if (!requirements) {
  console.error("No payment requirements in 402 response");
  process.exit(1);
}

console.log(`  Scheme: ${requirements.scheme}`);
console.log(`  Network: ${requirements.network}`);
console.log(`  Amount: ${requirements.amount}`);
console.log(`  Asset: ${requirements.asset}`);
console.log(`  Pay to: ${requirements.payTo}`);
console.log();

// Step 3: Create and sign the payment
console.log("Step 3: Creating payment transaction...");

const payloadResult = await clientScheme.createPaymentPayload(
  paymentRequired.x402Version,
  requirements,
);

const paymentPayload: PaymentPayload = {
  x402Version: payloadResult.x402Version,
  accepted: requirements,
  payload: payloadResult.payload,
  resource: paymentRequired.resource,
};

console.log("  Transaction signed successfully");
console.log();

// Step 4: Retry with payment
console.log("Step 4: Retrying request with payment...");

const encoded = Buffer.from(JSON.stringify(paymentPayload)).toString("base64");
const paidResponse = await fetch(`${SERVER_URL}${RESOURCE_PATH}`, {
  headers: {
    [PAYMENT_HEADER]: encoded,
  },
});

console.log(`  Status: ${paidResponse.status}`);
const result = await paidResponse.json();
console.log();
console.log("Response:", JSON.stringify(result, null, 2));
