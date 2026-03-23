import type { SIWxStorage } from "./types.js";

export class InMemorySIWxStorage implements SIWxStorage {
  private readonly payments: Map<string, Set<string>> = new Map();
  private readonly usedNonces: Set<string> = new Set();

  async hasPaid(resource: string, address: string): Promise<boolean> {
    const addresses = this.payments.get(resource);
    return addresses?.has(address) ?? false;
  }

  async recordPayment(resource: string, address: string): Promise<void> {
    const existing = this.payments.get(resource);
    if (existing) {
      existing.add(address);
    } else {
      this.payments.set(resource, new Set([address]));
    }
  }

  async hasUsedNonce(nonce: string): Promise<boolean> {
    return this.usedNonces.has(nonce);
  }

  async recordNonce(nonce: string): Promise<void> {
    this.usedNonces.add(nonce);
  }
}
