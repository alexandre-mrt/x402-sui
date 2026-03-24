import { SETTLEMENT_TTL_MS } from "./constants.js";

const DEFAULT_MAX_SIZE = 100_000;
const EVICTION_RATIO = 0.1;

export class SettlementCache {
  private readonly entries = new Map<string, number>();
  private readonly maxSize: number;

  constructor(maxSize = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
  }

  isDuplicate(key: string): boolean {
    this.prune();
    if (this.entries.has(key)) {
      return true;
    }
    // Evict oldest entries when full (LRU-style) instead of silently disabling protection
    if (this.entries.size >= this.maxSize) {
      const toRemove = Math.max(1, Math.floor(this.maxSize * EVICTION_RATIO));
      const iter = this.entries.keys();
      for (let i = 0; i < toRemove; i++) {
        const oldest = iter.next().value;
        if (oldest) this.entries.delete(oldest);
      }
    }
    this.entries.set(key, Date.now());
    return false;
  }

  private prune(): void {
    const cutoff = Date.now() - SETTLEMENT_TTL_MS;
    for (const [key, timestamp] of this.entries) {
      if (timestamp < cutoff) {
        this.entries.delete(key);
      }
    }
  }
}
