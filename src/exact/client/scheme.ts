import { Transaction } from "@mysten/sui/transactions";
import type {
  PaymentPayloadContext,
  PaymentPayloadResult,
  PaymentRequirements,
  SchemeNetworkClient,
} from "@x402/core/types";
import type { ClientSuiConfig, ClientSuiSigner } from "../../signer.js";
import type { ExactSuiPayload } from "../../types.js";
import { createSuiClient, validateSuiAddress } from "../../utils.js";

export class ExactSuiClientScheme implements SchemeNetworkClient {
  readonly scheme = "exact";

  constructor(
    private readonly signer: ClientSuiSigner,
    private readonly config: ClientSuiConfig = {},
  ) {}

  async createPaymentPayload(
    x402Version: number,
    paymentRequirements: PaymentRequirements,
    _context?: PaymentPayloadContext,
  ): Promise<PaymentPayloadResult> {
    // Validate payTo address
    if (!validateSuiAddress(paymentRequirements.payTo)) {
      throw new Error(`Invalid payTo address: ${paymentRequirements.payTo}`);
    }

    // Validate amount
    let amount: bigint;
    try {
      amount = BigInt(paymentRequirements.amount);
    } catch {
      throw new Error(`Invalid payment amount: ${paymentRequirements.amount}`);
    }
    if (amount <= 0n) {
      throw new Error(`Payment amount must be positive, got: ${paymentRequirements.amount}`);
    }

    const client = createSuiClient(paymentRequirements.network, this.config.rpcUrl);
    const gasStation =
      typeof paymentRequirements.extra?.gasStation === "string"
        ? paymentRequirements.extra.gasStation
        : undefined;

    const tx = new Transaction();
    tx.setSender(this.signer.address);
    const isSuiNative = paymentRequirements.asset === "0x2::sui::SUI";

    if (isSuiNative) {
      const splitResult = tx.splitCoins(tx.gas, [amount]);
      tx.transferObjects([splitResult], paymentRequirements.payTo);
    } else {
      const coins = await client.getCoins({
        owner: this.signer.address,
        coinType: paymentRequirements.asset,
      });

      if (coins.data.length === 0) {
        throw new Error(
          `No ${paymentRequirements.asset} coins found for address ${this.signer.address}`,
        );
      }

      const totalBalance = coins.data.reduce((sum, c) => sum + BigInt(c.balance), 0n);
      if (totalBalance < amount) {
        throw new Error(
          `Insufficient balance: have ${totalBalance}, need ${amount} of ${paymentRequirements.asset}`,
        );
      }

      const firstCoin = coins.data[0];
      if (!firstCoin) {
        throw new Error("No coins available after balance check");
      }
      const primaryCoin = tx.object(firstCoin.coinObjectId);
      if (coins.data.length > 1) {
        tx.mergeCoins(
          primaryCoin,
          coins.data.slice(1).map((c: { coinObjectId: string }) => tx.object(c.coinObjectId)),
        );
      }

      const splitResult = tx.splitCoins(primaryCoin, [amount]);
      tx.transferObjects([splitResult], paymentRequirements.payTo);
    }

    // Set gas budget if specified
    const gasBudget = paymentRequirements.extra?.gasBudget;
    if (typeof gasBudget === "number" || typeof gasBudget === "string") {
      tx.setGasBudget(BigInt(gasBudget));
    }

    let txBytes: Uint8Array;
    let signature: string;
    let bytes: string;

    if (gasStation) {
      // Sponsored transaction: interactive gas station protocol per Sui x402 spec
      // 1. Build partial transaction (without gas) as kind-only bytes
      const partialBytes = await tx.build({ client, onlyTransactionKind: true });
      const partialBase64 = Buffer.from(partialBytes).toString("base64");

      // 2. Send to gas station to get a complete transaction with gas info
      const gasStationResponse = await fetch(gasStation, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender: this.signer.address,
          transactionKind: partialBase64,
        }),
      });

      if (!gasStationResponse.ok) {
        throw new Error(`Gas station returned ${gasStationResponse.status}`);
      }

      const gasStationData = (await gasStationResponse.json()) as { transaction: string };
      if (!gasStationData.transaction) {
        throw new Error("Gas station did not return a transaction");
      }

      // 3. Sign the complete transaction from gas station
      txBytes = Uint8Array.from(Buffer.from(gasStationData.transaction, "base64"));
      const signed = await this.signer.signTransaction(txBytes);
      signature = signed.signature;
      bytes = signed.bytes;
    } else {
      // Non-sponsored: build and sign directly
      txBytes = await tx.build({ client });
      const signed = await this.signer.signTransaction(txBytes);
      signature = signed.signature;
      bytes = signed.bytes;
    }

    const payload: ExactSuiPayload = {
      transaction: bytes,
      signature,
    };

    return {
      x402Version,
      payload: payload as unknown as Record<string, unknown>,
    };
  }
}
