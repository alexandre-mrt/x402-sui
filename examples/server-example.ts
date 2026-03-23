/**
 * x402-sui Server Example
 *
 * Demonstrates how to use @x402/sui on the server side to protect
 * Express routes with USDC payments on Sui.
 *
 * NOTE: This is an illustrative example, not meant to be executed directly.
 * Replace placeholder values with real addresses and endpoints.
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import { ExactSuiFacilitatorScheme, ExactSuiServerScheme, toFacilitatorSuiSigner } from "@x402/sui";
import express from "express";

// ---------------------------------------------------------------------------
// 1. Create a Sui keypair for the facilitator (gas sponsor)
// ---------------------------------------------------------------------------
const privateKey = process.env.FACILITATOR_PRIVATE_KEY;
if (!privateKey) throw new Error("FACILITATOR_PRIVATE_KEY env var is required");
const facilitatorKeypair = Ed25519Keypair.fromSecretKey(privateKey);

// ---------------------------------------------------------------------------
// 2. Create signer and scheme instances
// ---------------------------------------------------------------------------
const facilitatorSigner = toFacilitatorSuiSigner(
  facilitatorKeypair,
  "sui:testnet", // CAIP-2 network identifier
);

const facilitatorScheme = new ExactSuiFacilitatorScheme(facilitatorSigner);
const serverScheme = new ExactSuiServerScheme();

// ---------------------------------------------------------------------------
// 3. Register Sui schemes with the x402 resource server
// ---------------------------------------------------------------------------
const resourceServer = x402ResourceServer({
  facilitatorSchemes: [facilitatorScheme],
  serverSchemes: [serverScheme],
});

// ---------------------------------------------------------------------------
// 4. Set up Express with the payment middleware
// ---------------------------------------------------------------------------
const app = express();

// The address that receives USDC payments
const RESOURCE_OWNER_ADDRESS = "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef";

app.use(
  "/premium",
  paymentMiddleware(resourceServer, {
    price: 0.01, // $0.01 in USDC
    network: "sui:testnet",
    payTo: RESOURCE_OWNER_ADDRESS,
  }),
);

// ---------------------------------------------------------------------------
// 5. Define protected routes
// ---------------------------------------------------------------------------
app.get("/premium/data", (_req, res) => {
  res.json({ message: "You paid for this content!" });
});

app.get("/free/health", (_req, res) => {
  res.json({ status: "ok" });
});

// ---------------------------------------------------------------------------
// 6. Start the server
// ---------------------------------------------------------------------------
const PORT = process.env.PORT ?? 4020;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`  Protected: GET /premium/data (0.01 USDC on sui:testnet)`);
  console.log(`  Free:      GET /free/health`);
});
