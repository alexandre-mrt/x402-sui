/**
 * x402-sui E2E Example: Resource Server
 *
 * Runs a Bun HTTP server with a paywall-protected endpoint.
 * Uses x402ResourceServer with an HTTP facilitator client.
 *
 * Usage:
 *   PAY_TO_ADDRESS=0x... FACILITATOR_URL=http://localhost:4022 bun run examples/e2e/server.ts
 */

import { HTTPFacilitatorClient, x402ResourceServer } from "@x402/core/server";
import type { Network, PaymentPayload, PaymentRequired } from "@x402/core/types";
import { ExactSuiServerScheme } from "../../src/exact/server/scheme.js";

const SERVER_PORT = 4020;
const SUI_NETWORK: Network = (process.env.SUI_NETWORK as Network) ?? "sui:testnet";
const FACILITATOR_URL = process.env.FACILITATOR_URL ?? "http://localhost:4022";

const PAY_TO_ADDRESS = process.env.PAY_TO_ADDRESS;
if (!PAY_TO_ADDRESS) {
  console.error("Error: PAY_TO_ADDRESS environment variable is required");
  process.exit(1);
}

// Set up the resource server with an HTTP facilitator client
const facilitatorClient = new HTTPFacilitatorClient({ url: FACILITATOR_URL });
const resourceServer = new x402ResourceServer(facilitatorClient);

// Register the Sui server scheme
const serverScheme = new ExactSuiServerScheme();
resourceServer.register(SUI_NETWORK, serverScheme);

// Initialize: fetches /supported from the facilitator
await resourceServer.initialize();

console.log(`Resource server running on http://localhost:${SERVER_PORT}`);
console.log(`  Facilitator: ${FACILITATOR_URL}`);
console.log(`  Pay to: ${PAY_TO_ADDRESS}`);
console.log(`  Network: ${SUI_NETWORK}`);
console.log(`  GET /api/premium-data  (0.01 USDC, paywall-protected)`);
console.log(`  GET /health            (free)`);

const PAYMENT_HEADER = "x-payment";
const PAYMENT_REQUIRED_HEADER = "x-payment-required";

Bun.serve({
  port: SERVER_PORT,

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "ok" });
    }

    if (url.pathname === "/api/premium-data") {
      return await handlePremiumData(req);
    }

    return Response.json({ error: "Not found" }, { status: 404 });
  },
});

async function handlePremiumData(req: Request): Promise<Response> {
  const paymentHeader = req.headers.get(PAYMENT_HEADER);

  // If no payment provided, return 402 with payment requirements
  if (!paymentHeader) {
    return await buildPaymentRequiredResponse();
  }

  // Parse the payment payload
  let paymentPayload: PaymentPayload;
  try {
    paymentPayload = JSON.parse(
      Buffer.from(paymentHeader, "base64").toString("utf-8"),
    ) as PaymentPayload;
  } catch {
    return Response.json({ error: "Invalid payment header" }, { status: 400 });
  }

  // Build requirements and find matching one
  const requirements = await resourceServer.buildPaymentRequirements({
    scheme: "exact",
    payTo: PAY_TO_ADDRESS,
    price: 0.01,
    network: SUI_NETWORK,
    maxTimeoutSeconds: 60,
  });

  const matchedRequirements = resourceServer.findMatchingRequirements(requirements, paymentPayload);

  if (!matchedRequirements) {
    return Response.json({ error: "No matching payment requirements" }, { status: 400 });
  }

  // Settle the payment
  const settleResult = await resourceServer.settlePayment(paymentPayload, matchedRequirements);

  if (!settleResult.success) {
    return Response.json(
      {
        error: "Payment settlement failed",
        reason: settleResult.errorReason,
        message: settleResult.errorMessage,
      },
      { status: 402 },
    );
  }

  // Payment succeeded, return the premium data
  return Response.json({
    data: {
      temperature: 22.5,
      humidity: 65,
      conditions: "Partly cloudy",
      location: "San Francisco, CA",
      timestamp: new Date().toISOString(),
    },
    payment: {
      transaction: settleResult.transaction,
      network: settleResult.network,
      payer: settleResult.payer,
    },
  });
}

async function buildPaymentRequiredResponse(): Promise<Response> {
  const requirements = await resourceServer.buildPaymentRequirements({
    scheme: "exact",
    payTo: PAY_TO_ADDRESS,
    price: 0.01,
    network: SUI_NETWORK,
    maxTimeoutSeconds: 60,
  });

  const paymentRequired: PaymentRequired = await resourceServer.createPaymentRequiredResponse(
    requirements,
    {
      url: "/api/premium-data",
      description: "Premium weather data",
      mimeType: "application/json",
    },
    "Payment required to access this resource",
  );

  const encoded = Buffer.from(JSON.stringify(paymentRequired)).toString("base64");

  return new Response(JSON.stringify(paymentRequired), {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      [PAYMENT_REQUIRED_HEADER]: encoded,
    },
  });
}
