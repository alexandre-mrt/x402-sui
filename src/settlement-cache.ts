import { SETTLEMENT_TTL_MS } from "./constants.js";

export class SettlementCache {
  private readonly entries = new Map<string, number>();

  isDuplicate(key: string): boolean {
    this.prune();
    if (this.entries.has(key)) {
      return true;
    }
    this.entries.set(key, Date.now());
    return false;
  }

  private prune(): void {
    const cutoff = Date.now() - SETTLEMENT_TTL_MS;
    for (const [key, timestamp] of this.entries) {
      if (timestamp < cutoff) {
        this.entries.delete(key);
      } else {
        break;
      }
    }
  }
}
