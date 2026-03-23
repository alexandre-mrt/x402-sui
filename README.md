# @x402/sui

[![License: Apache-2.0](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](./LICENSE)

x402 payment protocol implementation for the Sui blockchain. Enables any HTTP resource to accept USDC payments on Sui via the [HTTP 402 Payment Required](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/402) flow.

## Features

- **Client scheme** -- build and sign payment transactions from the browser or backend
- **Server scheme** -- Express middleware that gates routes behind a price
- **Facilitator scheme** -- verify and settle payments on-chain (dry-run + execute)
- **Sponsored transactions** -- facilitator can cover gas for the payer
- **No custom Move contracts** -- uses Sui Programmable Transaction Blocks (PTBs) with native `SplitCoins` + `TransferObjects`
- **Multi-network** -- mainnet, testnet, and devnet out of the box

## Installation

```bash
bun add @x402/sui @mysten/sui
```

> Also install a framework integration: `bun add @x402/fetch` (client) or `bun add @x402/express` (server).

## Quick Start

### Client (paying for a resource)

```ts
import { wrapFetchWithPayment } from "@x402/fetch";
import { ExactSuiClientScheme, toClientSuiSigner } from "@x402/sui";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";

const keypair = Ed25519Keypair.fromSecretKey(process.env.SUI_PRIVATE_KEY!);
const clientSigner = toClientSuiSigner(keypair);
const clientScheme = new ExactSuiClientScheme(clientSigner);

const paidFetch = wrapFetchWithPayment(fetch, {
  clientSchemes: [clientScheme],
});

const res = await paidFetch("https://api.example.com/premium/data");
console.log(await res.json());
```

### Server (protecting a resource)

```ts
import { paymentMiddleware, x402ResourceServer } from "@x402/express";
import {
  ExactSuiFacilitatorScheme,
  ExactSuiServerScheme,
  toFacilitatorSuiSigner,
} from "@x402/sui";
import { Ed25519Keypair } from "@mysten/sui/keypairs/ed25519";
import express from "express";

const facilitatorKeypair = Ed25519Keypair.fromSecretKey(
  process.env.FACILITATOR_PRIVATE_KEY!,
);
const facilitatorSigner = toFacilitatorSuiSigner(facilitatorKeypair, "sui:testnet");
const facilitatorScheme = new ExactSuiFacilitatorScheme(facilitatorSigner);
const serverScheme = new ExactSuiServerScheme();

const resourceServer = x402ResourceServer({
  facilitatorSchemes: [facilitatorScheme],
  serverSchemes: [serverScheme],
});

const app = express();
app.use(
  "/premium",
  paymentMiddleware(resourceServer, {
    price: 0.01,
    network: "sui:testnet",
    payTo: "0x<resource_owner_address>",
  }),
);
app.get("/premium/data", (_req, res) => res.json({ data: "paid content" }));
app.listen(4020);
```

See [`examples/`](./examples/) for complete annotated examples.

## Architecture

```
  Client                    Server                    Facilitator             Sui
  ------                    ------                    -----------             ---
    |                         |                           |                    |
    |  GET /premium/data      |                           |                    |
    |------------------------>|                           |                    |
    |  402 PaymentRequired    |                           |                    |
    |  + PaymentRequirements  |                           |                    |
    |<------------------------|                           |                    |
    |                         |                           |                    |
    |  Build PTB (SplitCoins  |                           |                    |
    |  + TransferObjects)     |                           |                    |
    |  Sign with Ed25519      |                           |                    |
    |                         |                           |                    |
    |  GET /premium/data      |                           |                    |
    |  + X-PAYMENT header     |                           |                    |
    |------------------------>|                           |                    |
    |                         |  verify(payload)          |                    |
    |                         |-------------------------->|                    |
    |                         |                           |  dryRunTransaction |
    |                         |                           |------------------->|
    |                         |                           |<-------------------|
    |                         |  { isValid: true }        |                    |
    |                         |<--------------------------|                    |
    |                         |                           |                    |
    |                         |  settle(payload)          |                    |
    |                         |-------------------------->|                    |
    |                         |                           |  executeTransaction|
    |                         |                           |------------------->|
    |                         |                           |  waitForTransaction|
    |                         |                           |------------------->|
    |                         |                           |<-------------------|
    |                         |  { success, digest }      |                    |
    |                         |<--------------------------|                    |
    |                         |                           |                    |
    |  200 OK + response body |                           |                    |
    |<------------------------|                           |                    |
```

## Supported Networks

| Network  | CAIP-2 ID      | USDC Coin Type                                                               |
| -------- | -------------- | ---------------------------------------------------------------------------- |
| Mainnet  | `sui:mainnet`  | `0xdba3...00e7::usdc::USDC` ([full](https://suiscan.xyz/mainnet/coin/0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC)) |
| Testnet  | `sui:testnet`  | `0xa1ec...7e29::usdc::USDC` ([full](https://suiscan.xyz/testnet/coin/0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC)) |
| Devnet   | `sui:devnet`   | Same as testnet                                                              |

## API Reference

### Signers

| Export                      | Description                                      |
| --------------------------- | ------------------------------------------------ |
| `toClientSuiSigner(signer)` | Wraps a `@mysten/sui` `Signer` for client use    |
| `toFacilitatorSuiSigner(signer, network, rpcUrl?)` | Wraps a `Signer` for facilitator use |

### Schemes

| Export                       | Role         | Description                             |
| ---------------------------- | ------------ | --------------------------------------- |
| `ExactSuiClientScheme`       | Client       | Builds and signs payment PTBs           |
| `ExactSuiServerScheme`       | Server       | Parses prices into USDC asset amounts   |
| `ExactSuiFacilitatorScheme`  | Facilitator  | Verifies and settles payments on-chain  |

### Types

| Export               | Description                                       |
| -------------------- | ------------------------------------------------- |
| `ClientSuiSigner`    | Interface for client transaction signing           |
| `ClientSuiConfig`    | Optional config (custom RPC URL)                   |
| `FacilitatorSuiSigner` | Interface for facilitator operations             |
| `ExactSuiPayload`    | Payment payload shape (transaction + signature)    |

### Utilities

| Export                  | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `createSuiClient`       | Create a `SuiJsonRpcClient` for a network      |
| `normalizeNetwork`      | Validate and normalize a CAIP-2 network ID     |
| `getUsdcCoinType`       | Get the USDC coin type for a given network     |
| `convertToTokenAmount`  | Convert a decimal string to token base units   |
| `validateSuiAddress`    | Check if a string is a valid Sui address       |
| `SettlementCache`       | Prevents duplicate settlement of payments      |

### Constants

`SUI_MAINNET_CAIP2`, `SUI_TESTNET_CAIP2`, `SUI_DEVNET_CAIP2`, `USDC_MAINNET_COIN_TYPE`, `USDC_TESTNET_COIN_TYPE`, `USDC_DEVNET_COIN_TYPE`, `USDC_DECIMALS`

## Related

- [x402 Protocol Spec](https://x402.org)
- [coinbase/x402](https://github.com/coinbase/x402) -- reference implementation (EVM + SVM)
- [@mysten/sui](https://www.npmjs.com/package/@mysten/sui) -- Sui TypeScript SDK
- [Sui Documentation](https://docs.sui.io)

## License

[Apache-2.0](./LICENSE)
