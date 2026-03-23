import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SETTLEMENT_TTL_MS } from "./constants.js";
import { SettlementCache } from "./settlement-cache.js";

describe("SettlementCache", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns false on first call (not a duplicate)", () => {
    const cache = new SettlementCache();
    expect(cache.isDuplicate("tx:sig:1")).toBe(false);
  });

  it("returns true on second call with the same key (is a duplicate)", () => {
    const cache = new SettlementCache();
    cache.isDuplicate("tx:sig:1");
    expect(cache.isDuplicate("tx:sig:1")).toBe(true);
  });

  it("handles different keys independently", () => {
    const cache = new SettlementCache();
    cache.isDuplicate("key-a");
    cache.isDuplicate("key-b");

    expect(cache.isDuplicate("key-a")).toBe(true);
    expect(cache.isDuplicate("key-b")).toBe(true);
    expect(cache.isDuplicate("key-c")).toBe(false);
  });

  it("handles empty key", () => {
    const cache = new SettlementCache();
    expect(cache.isDuplicate("")).toBe(false);
    expect(cache.isDuplicate("")).toBe(true);
  });

  it("handles very long key", () => {
    const cache = new SettlementCache();
    const longKey = "x".repeat(10_000);
    expect(cache.isDuplicate(longKey)).toBe(false);
    expect(cache.isDuplicate(longKey)).toBe(true);
  });

  it("evicts entries after TTL expires", () => {
    const cache = new SettlementCache();

    cache.isDuplicate("old-key");
    expect(cache.isDuplicate("old-key")).toBe(true);

    // Advance time past the TTL
    vi.advanceTimersByTime(SETTLEMENT_TTL_MS + 1);

    // After TTL, the key should be pruned and treated as new
    expect(cache.isDuplicate("old-key")).toBe(false);
  });

  it("does not evict entries before TTL", () => {
    const cache = new SettlementCache();

    cache.isDuplicate("key");

    // Advance time to just before TTL
    vi.advanceTimersByTime(SETTLEMENT_TTL_MS - 1);

    expect(cache.isDuplicate("key")).toBe(true);
  });

  it("handles multiple prune cycles correctly", () => {
    const cache = new SettlementCache();

    // First batch
    cache.isDuplicate("batch1-a");
    cache.isDuplicate("batch1-b");

    // Advance half the TTL
    vi.advanceTimersByTime(SETTLEMENT_TTL_MS / 2);

    // Second batch
    cache.isDuplicate("batch2-a");

    // Advance past TTL for first batch but not second
    vi.advanceTimersByTime(SETTLEMENT_TTL_MS / 2 + 1);

    // First batch should be pruned
    expect(cache.isDuplicate("batch1-a")).toBe(false);
    expect(cache.isDuplicate("batch1-b")).toBe(false);

    // Second batch should still be duplicate
    expect(cache.isDuplicate("batch2-a")).toBe(true);
  });

  it("handles concurrent access patterns (sequential calls)", () => {
    const cache = new SettlementCache();
    const keys = Array.from({ length: 100 }, (_, i) => `key-${i}`);

    // Insert all keys
    for (const key of keys) {
      expect(cache.isDuplicate(key)).toBe(false);
    }

    // All should be duplicates now
    for (const key of keys) {
      expect(cache.isDuplicate(key)).toBe(true);
    }
  });

  it("prunes only expired entries in iteration order", () => {
    const cache = new SettlementCache();

    // Insert keys at different times
    cache.isDuplicate("first");
    vi.advanceTimersByTime(1000);
    cache.isDuplicate("second");
    vi.advanceTimersByTime(1000);
    cache.isDuplicate("third");

    // Advance time so only "first" expires (total elapsed for "first": TTL + 1ms)
    vi.advanceTimersByTime(SETTLEMENT_TTL_MS - 2000 + 1);

    // "first" should be pruned, others should remain
    expect(cache.isDuplicate("first")).toBe(false);
    expect(cache.isDuplicate("second")).toBe(true);
    expect(cache.isDuplicate("third")).toBe(true);
  });
});
