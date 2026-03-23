import { describe, expect, it } from "vitest";
import { SettlementCache } from "./settlement-cache.js";

describe("SettlementCache", () => {
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
});
