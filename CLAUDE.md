# x402-sui

## Overview
TypeScript implementation of the x402 payment protocol for the Sui blockchain. Enables HTTP resources to accept USDC payments on Sui via the HTTP 402 Payment Required flow.

## Structure
```
src/
  index.ts              — barrel exports
  types.ts              — Sui-specific payload types
  constants.ts          — USDC addresses, CAIP-2 network IDs, RPC URLs
  utils.ts              — network normalization, transaction helpers
  signer.ts             — client/facilitator signer interfaces + factories
  settlement-cache.ts   — duplicate settlement prevention
  exact/
    client/
      scheme.ts         — SchemeNetworkClient: builds payment PTBs
    facilitator/
      scheme.ts         — SchemeNetworkFacilitator: verify + settle
    server/
      scheme.ts         — SchemeNetworkServer: price parsing
examples/
  client-example.ts     — client usage
  server-example.ts     — server middleware usage
```

## Stack
- Runtime: Bun
- Language: TypeScript (strict)
- Sui SDK: @mysten/sui
- x402 core: @x402/core
- Tests: Vitest
- Lint/Format: Biome

## Commands
- `bun run build` — build to dist/
- `bun run test` — run tests
- `bun run lint` — lint + format with biome
- `bun run check` — type check

## Key patterns
- Follows the SVM mechanism pattern from coinbase/x402
- Three roles: client (signs PTB), facilitator (verifies + settles), server (middleware)
- Payment payload: base64-encoded signed Sui transaction
- CAIP-2 network IDs: `sui:mainnet`, `sui:testnet`, `sui:devnet`
- No custom Move contracts needed: uses PTBs (SplitCoins + TransferObjects)
