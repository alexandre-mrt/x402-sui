/**
 * x402-sui E2E Example: Facilitator
 *
 * Runs a local facilitator HTTP server on port 4022.
 * The facilitator verifies and settles USDC payments on Sui testnet.
 *
 * Usage:
 *   FACILITATOR_PRIVATE_KEY=... bun run examples/e2e/facilitator.ts
 */

import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import type { Network } from "@x402/core/types";
import { createFacilitatorServer } from "../../src/facilitator/server.js";
import { toFacilitatorSuiSigner } from "../../src/signer.js";

const FACILITATOR_PORT = 4022;
const SUI_NETWORK: Network = (process.env.SUI_NETWORK as Network) ?? "sui:testnet";

const privateKey = process.env.FACILITATOR_PRIVATE_KEY;
if (!privateKey) {
  console.error("Error: FACILITATOR_PRIVATE_KEY environment variable is required");
  process.exit(1);
}

const keypair = Ed25519Keypair.fromSecretKey(privateKey);
const signer = toFacilitatorSuiSigner(keypair, SUI_NETWORK);

const server = createFacilitatorServer({
  port: FACILITATOR_PORT,
  signer,
  networks: [SUI_NETWORK],
});

console.log(`Facilitator server running on http://localhost:${server.port}`);
console.log(`  Network: ${SUI_NETWORK}`);
console.log(`  Address: ${keypair.toSuiAddress()}`);
console.log(`  GET  /supported`);
console.log(`  POST /verify`);
console.log(`  POST /settle`);
