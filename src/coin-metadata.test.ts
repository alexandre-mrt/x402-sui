import { describe, expect, it, vi } from "vitest";
import { CoinMetadataCache } from "./coin-metadata.js";

// biome-ignore lint/suspicious/noExplicitAny: mock client for testing
function mockClient(metadata: { decimals: number; symbol: string; name: string } | null): any {
  return {
    getCoinMetadata: vi.fn().mockResolvedValue(
      metadata
        ? {
            id: "0xmock",
            decimals: metadata.decimals,
            symbol: metadata.symbol,
            name: metadata.name,
            description: "",
            iconUrl: null,
          }
        : null,
    ),
  };
}

describe("CoinMetadataCache", () => {
  const COIN_TYPE = "0xabc::token::TOKEN";

  it("fetches metadata from the client", async () => {
    const client = mockClient({ decimals: 8, symbol: "TKN", name: "Token" });
    const cache = new CoinMetadataCache(client);

    const metadata = await cache.getMetadata(COIN_TYPE);

    expect(metadata).toEqual({ decimals: 8, symbol: "TKN", name: "Token" });
    expect(client.getCoinMetadata).toHaveBeenCalledWith({ coinType: COIN_TYPE });
  });

  it("caches metadata and does not call client twice", async () => {
    const client = mockClient({ decimals: 6, symbol: "USDC", name: "USD Coin" });
    const cache = new CoinMetadataCache(client);

    await cache.getMetadata(COIN_TYPE);
    await cache.getMetadata(COIN_TYPE);

    expect(client.getCoinMetadata).toHaveBeenCalledTimes(1);
  });

  it("getDecimals returns the decimals field", async () => {
    const client = mockClient({ decimals: 9, symbol: "SUI", name: "Sui" });
    const cache = new CoinMetadataCache(client);

    const decimals = await cache.getDecimals(COIN_TYPE);

    expect(decimals).toBe(9);
  });

  it("throws when no metadata is found", async () => {
    const client = mockClient(null);
    const cache = new CoinMetadataCache(client);

    await expect(cache.getMetadata(COIN_TYPE)).rejects.toThrow("No metadata found for coin type");
  });

  it("caches different coin types separately", async () => {
    const client = mockClient({ decimals: 6, symbol: "A", name: "TokenA" });
    const cache = new CoinMetadataCache(client);

    await cache.getMetadata("0xaaa::a::A");
    await cache.getMetadata("0xbbb::b::B");

    expect(client.getCoinMetadata).toHaveBeenCalledTimes(2);
  });

  it("clearCache forces a fresh fetch", async () => {
    const client = mockClient({ decimals: 6, symbol: "X", name: "X" });
    const cache = new CoinMetadataCache(client);

    await cache.getMetadata(COIN_TYPE);
    cache.clearCache();
    await cache.getMetadata(COIN_TYPE);

    expect(client.getCoinMetadata).toHaveBeenCalledTimes(2);
  });
});
