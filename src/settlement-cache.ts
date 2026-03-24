import { SETTLEMENT_TTL_MS } from "./constants.js";

const DEFAULT_MAX_SIZE = 100_000;

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
    // Reject if cache is full (prevents memory exhaustion DoS)
    if (this.entries.size >= this.maxSize) {
      return false;
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
