# Night Shift Plan — 2026-03-23

## Objective
Implement x402 payment protocol support for the Sui blockchain as a standalone TypeScript package (`@x402/sui`). This is the first x402 implementation for Sui, following the pattern established by the SVM (Solana) mechanism in the coinbase/x402 repository.

## Architecture
- **Pattern**: Mirrors `@x402/svm` from coinbase/x402
- **Three roles**: Client, Facilitator, Server (each as a `SchemeNetwork*` implementation)
- **Payment flow**: Client builds a Sui PTB (SplitCoins + TransferObjects for USDC), signs it, sends base64-encoded transaction as payload. Facilitator verifies transaction structure and simulates via dryRun, then executes for settlement.
- **No custom Move contracts**: Sui's PTBs handle everything natively
- **Network IDs**: CAIP-2 format (`sui:mainnet`, `sui:testnet`, `sui:devnet`)

## Parallelizable workstreams
- **Workstream A** (independent): types.ts + constants.ts + utils.ts + settlement-cache.ts
- **Workstream B** (independent): signer.ts (interfaces + factories)
- **Sequential** (depends on A+B): client/scheme.ts, facilitator/scheme.ts, server/scheme.ts
- **Sequential** (depends on all above): tests, examples, README

## Steps (ordered by dependency)
1. [scaffold] — project setup, deps, config — Workstream A
2. [types] — ExactSuiPayload, re-export core types — Workstream A
3. [constants] — USDC addresses, CAIP-2 IDs, RPC URLs — Workstream A
4. [utils] — network normalization, address validation, tx helpers — Workstream A
5. [settlement-cache] — duplicate settlement prevention — Workstream A
6. [signer] — ClientSuiSigner, FacilitatorSuiSigner interfaces — Workstream B
7. [client] — SchemeNetworkClient: createPaymentPayload — Sequential
8. [facilitator] — SchemeNetworkFacilitator: verify + settle — Sequential
9. [server] — SchemeNetworkServer: parsePrice + enhanceRequirements — Sequential
10. [tests] — unit tests for all modules — Sequential
11. [examples] — client + server usage examples — Sequential
12. [readme] — comprehensive README — Sequential
13. [validation] — build, test, lint, push — Sequential

## Pre-made decisions
- **USDC only** for initial implementation (most common x402 use case)
- **No gas sponsorship** in v0.1 (spec mentions it but it adds complexity)
- **Testnet USDC** address from Circle's official deployment on Sui
- **@mysten/sui v2** as the Sui SDK (latest)
- **Vitest** for tests (not bun:test) for consistency with x402 ecosystem

## Estimate
- ~12 source files to create
- ~3 test files
- ~2 example files
- 1 README

## Night Shift Summary — 2026-03-23

### Completed
- [x] Project scaffold (bun, biome, vitest, tsconfig)
- [x] GitHub repo created and pushed
- [x] Core types (ExactSuiPayload)
- [x] Constants (USDC addresses mainnet/testnet/devnet, CAIP-2 IDs, RPC URLs)
- [x] Utilities (network normalization, address validation, USDC coin type lookup, amount conversion)
- [x] Signer interfaces and factories (ClientSuiSigner, FacilitatorSuiSigner)
- [x] Settlement cache (duplicate prevention with TTL)
- [x] Client scheme (ExactSuiClientScheme: PTB with SplitCoins + TransferObjects)
- [x] Facilitator scheme (ExactSuiFacilitatorScheme: dryRun verify + execute settle)
- [x] Server scheme (ExactSuiServerScheme: USDC price parsing + gasOwner injection)
- [x] 42 unit tests passing
- [x] Client and server examples
- [x] Comprehensive README with architecture diagram

### Decisions made
- Used SuiJsonRpcClient (not deprecated SuiClient) for Sui SDK v2 compatibility
- No custom Move contracts: PTBs handle everything natively
- USDC-only for v0.1 (extensible via MoneyParser chain)
- Gas sponsorship support via gasOwner in PaymentRequirements.extra
- Vitest for tests (ecosystem consistency with x402)

### Not completed / Needs review
- Build script (bun build) not verified: may need adjustment for proper ESM output
- No integration tests against real Sui testnet
- No gas sponsorship end-to-end test
- Package not published to npm

### Final validation
- Build: N/A (library, type check passes)
- Tests: 42 pass / 0 fail
- Lint: pass (0 errors)
- Visual: N/A

### Stats (Phase 1)
- Files created: 22
- Files modified: 0
- Tests: 42 pass / 0 fail
- Commits: 5

---

## Night Shift Extension — 2026-03-23 (Phase 2)

### Completed
- [x] Registration functions (registerExactSuiClientScheme, registerExactSuiFacilitatorScheme, registerExactSuiServerScheme)
- [x] Gas sponsorship: facilitator co-signs as gasOwner, multi-signature execution
- [x] Facilitator HTTP server (Bun.serve, /supported /verify /settle endpoints)
- [x] Working E2E example (facilitator + server + client, 3 components)
- [x] 142 comprehensive edge case tests (up from 42)
- [x] Updated README with registration helpers, local facilitator, e2e example

### New edge case tests added
- convertToTokenAmount: zero, negative, large numbers, scientific notation, NaN, empty, whitespace, leading zeros, 0/18 decimals
- validateSuiAddress: boundary lengths, no prefix, uppercase, special chars
- Settlement cache: TTL expiration (fake timers), concurrent access (100 keys), prune cycles
- Facilitator: zero/overflow amounts, overpayment, wrong coin type, empty fields, dryRun exceptions, ObjectOwner, gas sponsorship co-signing, execution failures
- Server: zero/negative/micro prices, custom MoneyParsers, field preservation
- Client: single/multiple coins, merging, gas budget/owner, no coins error
- Registration: wildcard/specific networks, policies, return value chaining

### Decisions made
- Facilitator HTTP server uses Bun.serve() (no Express dep for core package)
- E2E example uses manual 402 flow (no @x402/fetch dep needed)
- Registration functions follow exact SVM pattern for ecosystem consistency
- Multi-signature support added to FacilitatorSuiSigner.executeTransaction

### Final validation (Phase 2)
- Build: type check passes
- Tests: 142 pass / 0 fail
- Lint: pass (0 errors)
- Visual: N/A

---

## Night Shift Phase 3 — 2026-03-24

### Objective
Extend @x402/sui with extensions (SIWx, Offer/Receipt, Payment Identifier), multi-token support, MCP integration for AI agents, and npm publish setup.

### Completed
- [x] Multi-token support: token registry (USDC, SUI, AUSD, wUSDT, FDUSD), CoinMetadataCache, MoneyParser factories
- [x] Payment Identifier extension: generatePaymentId(), validation, server/client hooks
- [x] Sign-In-With-X (SIWx) for Sui: CAIP-122 message format, Ed25519 signature verification via @mysten/sui/verify, InMemorySIWxStorage, settle/request hooks
- [x] Offer/Receipt extension: JWS signing via jose, server extension with offer/receipt enrichment, client extraction utilities
- [x] MCP integration: createSuiPaymentWrapper() for paid MCP tools, utility functions for payment meta extraction, example MCP server
- [x] npm publish setup: tsup ESM build, prepublishOnly scripts, npm pack verified (6 files)

### Decisions made
- JWS format for Offer/Receipt (chain-agnostic, no EIP-712 dependency)
- Used @mysten/sui/verify for SIWx signature verification (native SDK, no extra deps)
- CAIP-122 ABNF message format for Sui SIWx (following Solana pattern)
- tsup for build (faster, simpler than manual bun build + tsc)
- @modelcontextprotocol/sdk as peer dependency for MCP integration

### Final validation (Phase 3)
- Build: pass (tsup, 60KB ESM + 16KB DTS)
- Tests: 236 pass / 0 fail / 8 skipped (integration)
- Lint: pass (0 errors)

### Stats (Phase 3)
- New files: ~30
- Test files: 16 total
- Tests: 236 pass (up from 150)
- Extensions: 3 (Payment Identifier, SIWx, Offer/Receipt)
- Commits: ~15 on branch
