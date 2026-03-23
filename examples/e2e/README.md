# x402-sui End-to-End Example

A complete working example demonstrating the x402 payment flow on Sui testnet with three components:

1. **Facilitator** (`facilitator.ts`) - Verifies and settles USDC payments on-chain
2. **Resource Server** (`server.ts`) - Protects an API endpoint with a USDC paywall
3. **Client** (`client.ts`) - Pays for access to the protected resource

## Prerequisites

- [Bun](https://bun.sh) runtime installed
- Two Sui testnet wallets with private keys (one for client, one for facilitator)
- Testnet USDC tokens in the client wallet
- Testnet SUI for gas in both wallets

### Getting testnet tokens

1. Get testnet SUI from the [Sui faucet](https://faucet.testnet.sui.io/)
2. Get testnet USDC by swapping SUI on a testnet DEX or requesting from the USDC testnet faucet

## Setup

1. Copy the environment file:

```bash
cp .env.example .env
```

2. Fill in your private keys and addresses in `.env`:
   - `SUI_PRIVATE_KEY` - Client wallet private key (base64 or hex)
   - `PAY_TO_ADDRESS` - Sui address that receives payments (can be any address you control)
   - `FACILITATOR_PRIVATE_KEY` - Facilitator wallet private key (needs SUI for gas)

## Running

Open three terminals and run each component in order:

### Terminal 1: Start the facilitator

```bash
bun run examples/e2e/facilitator.ts
```

Expected output:
```
Facilitator server running on http://localhost:4022
  Network: sui:testnet
  Address: 0x...
  GET  /supported
  POST /verify
  POST /settle
```

### Terminal 2: Start the resource server

```bash
bun run examples/e2e/server.ts
```

Expected output:
```
Resource server running on http://localhost:4020
  Facilitator: http://localhost:4022
  Pay to: 0x...
  Network: sui:testnet
  GET /api/premium-data  (0.01 USDC, paywall-protected)
  GET /health            (free)
```

### Terminal 3: Run the client

```bash
bun run examples/e2e/client.ts
```

Expected output:
```
Client address: 0x...
Target: http://localhost:4020/api/premium-data

Step 1: Requesting protected resource...
Step 2: Received 402 Payment Required
  Scheme: exact
  Network: sui:testnet
  Amount: 10000
  Asset: 0xa1ec...::usdc::USDC
  Pay to: 0x...

Step 3: Creating payment transaction...
  Transaction signed successfully

Step 4: Retrying request with payment...
  Status: 200

Response: {
  "data": {
    "temperature": 22.5,
    "humidity": 65,
    "conditions": "Partly cloudy",
    "location": "San Francisco, CA",
    "timestamp": "2026-03-23T..."
  },
  "payment": {
    "transaction": "...",
    "network": "sui:testnet",
    "payer": "0x..."
  }
}
```

## Flow

1. Client sends `GET /api/premium-data` with no payment
2. Server responds with `402 Payment Required` including payment requirements
3. Client parses requirements, builds a USDC transfer transaction, signs it
4. Client retries the request with the signed transaction in the `x-payment` header
5. Server forwards the payment to the facilitator for settlement
6. Facilitator verifies the transaction via dry-run, then executes it on-chain
7. Server returns the premium data after successful payment
