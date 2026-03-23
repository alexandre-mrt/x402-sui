import { Transaction } from "@mysten/sui/transactions";
import type {
  PaymentPayloadContext,
  PaymentPayloadResult,
  PaymentRequirements,
  SchemeNetworkClient,
} from "@x402/core/types";
import type { ClientSuiConfig, ClientSuiSigner } from "../../signer.js";
import type { ExactSuiPayload } from "../../types.js";
import { createSuiClient } from "../../utils.js";

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
    const client = createSuiClient(paymentRequirements.network, this.config.rpcUrl);

    const tx = new Transaction();
    tx.setSender(this.signer.address);

    // Get USDC coins owned by the sender
    const coins = await client.getCoins({
      owner: this.signer.address,
      coinType: paymentRequirements.asset,
    });

    if (coins.data.length === 0) {
      throw new Error(
        `No ${paymentRequirements.asset} coins found for address ${this.signer.address}`,
      );
    }

    const amount = BigInt(paymentRequirements.amount);

    // If we have multiple coins, merge them first
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

    // Split the exact amount and transfer to recipient
    const splitResult = tx.splitCoins(primaryCoin, [amount]);
    tx.transferObjects([splitResult], paymentRequirements.payTo);

    // Set gas budget if specified
    const gasBudget = paymentRequirements.extra?.gasBudget;
    if (typeof gasBudget === "number" || typeof gasBudget === "string") {
      tx.setGasBudget(BigInt(gasBudget));
    }

    // If a gas sponsor (facilitator) is specified, use sponsored transaction
    const gasOwner = paymentRequirements.extra?.gasOwner;
    if (typeof gasOwner === "string") {
      tx.setGasOwner(gasOwner);
    }

    // Build and sign the transaction
    const txBytes = await tx.build({ client });
    const { signature, bytes } = await this.signer.signTransaction(txBytes);

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
