/**
 * x402-sui Client Example
 *
 * Demonstrates how to use @x402/sui on the client side to make
 * paid HTTP requests with USDC on Sui.
 *
 * NOTE: This is an illustrative example, not meant to be executed directly.
 * Replace placeholder values with real addresses and endpoints.
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactSuiClientScheme, toClientSuiSigner } from "@x402/sui";

// ---------------------------------------------------------------------------
// 1. Create a Sui keypair from a private key (never commit real keys)
// ---------------------------------------------------------------------------
const privateKey = process.env.SUI_PRIVATE_KEY;
if (!privateKey) throw new Error("SUI_PRIVATE_KEY env var is required");
const keypair = Ed25519Keypair.fromSecretKey(privateKey);

// ---------------------------------------------------------------------------
// 2. Wrap the keypair into a ClientSuiSigner
// ---------------------------------------------------------------------------
const clientSigner = toClientSuiSigner(keypair);

// ---------------------------------------------------------------------------
// 3. Create the ExactSuiClientScheme (optionally pass a custom RPC URL)
// ---------------------------------------------------------------------------
const clientScheme = new ExactSuiClientScheme(clientSigner, {
  rpcUrl: process.env.SUI_RPC_URL, // defaults to public fullnode if omitted
});

// ---------------------------------------------------------------------------
// 4. Wrap the global fetch so it handles 402 responses automatically
// ---------------------------------------------------------------------------
const paidFetch = wrapFetchWithPayment(fetch, {
  clientSchemes: [clientScheme],
});

// ---------------------------------------------------------------------------
// 5. Call a paid endpoint as if it were a normal fetch
// ---------------------------------------------------------------------------
const response = await paidFetch("https://api.example.com/premium/data", {
  method: "GET",
  headers: { "Content-Type": "application/json" },
});

const data = await response.json();
console.log("Paid response:", data);
