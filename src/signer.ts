import type { Signer } from "@mysten/sui/cryptography";
import type { Network } from "@x402/core/types";
import { createSuiClient } from "./utils.js";

export interface ClientSuiSigner {
  readonly address: string;
  signTransaction(txBytes: Uint8Array): Promise<{
    signature: string;
    bytes: string;
  }>;
}

export interface ClientSuiConfig {
  rpcUrl?: string;
}

export interface FacilitatorSuiSigner {
  getAddresses(): string[];
  dryRunTransaction(txBytes: string): Promise<{
    effects: { status: { status: string } };
    balanceChanges: Array<{
      owner: { AddressOwner: string } | { ObjectOwner: string } | Record<string, unknown>;
      coinType: string;
      amount: string;
    }>;
  }>;
  signTransaction(txBytes: Uint8Array): Promise<{
    signature: string;
    bytes: string;
  }>;
  executeTransaction(
    txBytes: string,
    signatures: string[],
  ): Promise<{
    digest: string;
    effects?: { status: { status: string } };
  }>;
  waitForTransaction(digest: string): Promise<{
    digest: string;
    effects?: { status: { status: string } };
  }>;
}

export function toClientSuiSigner(signer: Signer): ClientSuiSigner {
  return {
    address: signer.toSuiAddress(),
    async signTransaction(txBytes: Uint8Array) {
      return signer.signTransaction(txBytes);
    },
  };
}

export function toFacilitatorSuiSigner(
  signer: Signer,
  network: Network,
  rpcUrl?: string,
): FacilitatorSuiSigner {
  const client = createSuiClient(network, rpcUrl);
  const address = signer.toSuiAddress();

  return {
    getAddresses() {
      return [address];
    },

    async dryRunTransaction(txBytes: string) {
      const result = await client.dryRunTransactionBlock({
        transactionBlock: txBytes,
      });
      return {
        effects: {
          status: { status: result.effects.status.status },
        },
        balanceChanges: (result.balanceChanges ?? []).map((bc) => ({
          owner: bc.owner as
            | { AddressOwner: string }
            | { ObjectOwner: string }
            | Record<string, unknown>,
          coinType: bc.coinType,
          amount: bc.amount,
        })),
      };
    },

    async signTransaction(txBytes: Uint8Array) {
      return signer.signTransaction(txBytes);
    },

    async executeTransaction(txBytes: string, signatures: string[]) {
      const result = await client.executeTransactionBlock({
        transactionBlock: txBytes,
        signature: signatures,
        options: {
          showEffects: true,
        },
      });
      return {
        digest: result.digest,
        effects: result.effects ? { status: { status: result.effects.status.status } } : undefined,
      };
    },

    async waitForTransaction(digest: string) {
      const result = await client.waitForTransaction({
        digest,
        options: { showEffects: true },
      });
      return {
        digest: result.digest,
        effects: result.effects ? { status: { status: result.effects.status.status } } : undefined,
      };
    },
  };
}
