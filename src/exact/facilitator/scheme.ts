import { verifyTransactionSignature } from "@mysten/sui/verify";
import type {
  FacilitatorContext,
  Network,
  PaymentPayload,
  PaymentRequirements,
  SchemeNetworkFacilitator,
  SettleResponse,
  VerifyResponse,
} from "@x402/core/types";
import { SettlementCache } from "../../settlement-cache.js";
import type { FacilitatorSuiSigner } from "../../signer.js";
import type { ExactSuiPayload } from "../../types.js";
import { normalizeNetwork, validateSuiAddress } from "../../utils.js";

export interface ExactSuiFacilitatorOptions {
  gasStationUrl?: string;
}

export class ExactSuiFacilitatorScheme implements SchemeNetworkFacilitator {
  readonly scheme = "exact";
  readonly caipFamily = "sui:*";

  private readonly settlementCache: SettlementCache;
  private readonly gasStationUrl?: string;

  constructor(
    private readonly signer: FacilitatorSuiSigner,
    settlementCache?: SettlementCache,
    options?: ExactSuiFacilitatorOptions,
  ) {
    this.settlementCache = settlementCache ?? new SettlementCache();
    this.gasStationUrl = options?.gasStationUrl;
  }

  getExtra(_network: Network): Record<string, unknown> | undefined {
    // Per Sui x402 spec: communicate sponsorship via gasStation URL
    if (this.gasStationUrl) {
      return { gasStation: this.gasStationUrl };
    }
    return undefined;
  }

  getSigners(_network: string): string[] {
    return this.signer.getAddresses();
  }

  async verify(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
    _context?: FacilitatorContext,
  ): Promise<VerifyResponse> {
    try {
      // Validate scheme
      if (payload.accepted.scheme !== "exact") {
        return invalid("scheme_mismatch", "Payment scheme must be 'exact'");
      }

      // Validate network
      try {
        normalizeNetwork(requirements.network);
      } catch {
        return invalid("unsupported_network", `Unsupported network: ${requirements.network}`);
      }

      // Validate addresses
      if (!validateSuiAddress(requirements.payTo)) {
        return invalid("invalid_pay_to", `Invalid payTo address: ${requirements.payTo}`);
      }

      // Extract payload
      const suiPayload = payload.payload as unknown as ExactSuiPayload;
      if (!suiPayload.transaction || !suiPayload.signature) {
        return invalid("invalid_payload", "Missing transaction or signature in payload");
      }

      // Verify the cryptographic signature over the transaction bytes
      let signerAddress: string;
      try {
        const txBytes = Uint8Array.from(Buffer.from(suiPayload.transaction, "base64"));
        const publicKey = await verifyTransactionSignature(txBytes, suiPayload.signature);
        signerAddress = publicKey.toSuiAddress();
      } catch {
        return invalid("invalid_signature", "Transaction signature verification failed");
      }

      // Dry-run the transaction to validate it
      const dryRunResult = await this.signer.dryRunTransaction(suiPayload.transaction);

      // Check transaction simulation succeeded
      if (dryRunResult.effects.status.status !== "success") {
        return invalid("simulation_failed", "Transaction simulation failed");
      }

      // Verify the balance changes match the requirements
      const expectedAmount = BigInt(requirements.amount);
      const recipientChange = dryRunResult.balanceChanges.find((bc) => {
        if (!("AddressOwner" in bc.owner)) return false;
        return (
          bc.owner.AddressOwner === requirements.payTo &&
          bc.coinType === requirements.asset &&
          BigInt(bc.amount) === expectedAmount
        );
      });

      if (!recipientChange) {
        return invalid(
          "insufficient_payment",
          `Transaction does not transfer ${requirements.amount} of ${requirements.asset} to ${requirements.payTo}`,
        );
      }

      // Find the payer from balance changes (the one losing the token)
      const payerChange = dryRunResult.balanceChanges.find((bc) => {
        if (!("AddressOwner" in bc.owner)) return false;
        return bc.coinType === requirements.asset && BigInt(bc.amount) < 0n;
      });

      const payer =
        payerChange && "AddressOwner" in payerChange.owner
          ? (payerChange.owner as { AddressOwner: string }).AddressOwner
          : undefined;

      // Payer must be identifiable from balance changes
      if (!payer) {
        return invalid("payer_not_found", "Could not determine payer from balance changes");
      }

      // Verify the transaction signer matches the payer (prevents signature substitution)
      if (signerAddress !== payer) {
        return invalid(
          "signer_mismatch",
          `Transaction signer ${signerAddress} does not match payer ${payer}`,
        );
      }

      // Verify no unexpected side effects (prevents PTB injection attacks)
      const unexpectedChanges = dryRunResult.balanceChanges.filter((bc) => {
        if (!("AddressOwner" in bc.owner)) return true; // non-address owners are unexpected
        const addr = (bc.owner as { AddressOwner: string }).AddressOwner;
        // Expected: recipient gains the exact payment amount
        if (addr === requirements.payTo && bc.coinType === requirements.asset) return false;
        // Expected: payer loses the payment amount
        if (addr === payer && bc.coinType === requirements.asset && BigInt(bc.amount) < 0n)
          return false;
        // Expected: payer pays gas in SUI
        if (addr === payer && bc.coinType === "0x2::sui::SUI") return false;
        // Everything else is unexpected
        return true;
      });

      if (unexpectedChanges.length > 0) {
        return invalid(
          "unexpected_side_effects",
          "Transaction contains unexpected balance changes beyond the payment",
        );
      }

      return { isValid: true, payer };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown verification error";
      return invalid("verification_error", message);
    }
  }

  async settle(
    payload: PaymentPayload,
    requirements: PaymentRequirements,
    context?: FacilitatorContext,
  ): Promise<SettleResponse> {
    const suiPayload = payload.payload as unknown as ExactSuiPayload;
    if (!suiPayload.transaction || !suiPayload.signature) {
      return {
        success: false,
        errorReason: "invalid_payload",
        errorMessage: "Missing transaction or signature",
        transaction: "",
        network: requirements.network,
      };
    }

    // Check for duplicate settlement BEFORE verify (prevents TOCTOU race condition)
    const txDecoded = Buffer.from(suiPayload.transaction, "base64").toString("hex");
    const cacheKey = `${txDecoded}|${suiPayload.signature}`;
    if (this.settlementCache.isDuplicate(cacheKey)) {
      return {
        success: false,
        errorReason: "duplicate_settlement",
        errorMessage: "This payment has already been settled",
        transaction: "",
        network: requirements.network,
      };
    }

    // Verify the payment
    const verifyResult = await this.verify(payload, requirements, context);
    if (!verifyResult.isValid) {
      return {
        success: false,
        errorReason: verifyResult.invalidReason,
        errorMessage: verifyResult.invalidMessage,
        payer: verifyResult.payer,
        transaction: "",
        network: requirements.network,
      };
    }

    try {
      // Collect signatures: client signature + optional facilitator co-signature for gas sponsorship
      const signatures = [suiPayload.signature];

      // Gas-sponsored transaction: co-sign only if this facilitator is configured as gas sponsor
      // (uses own config, not attacker-controllable requirements.extra)
      if (this.gasStationUrl && verifyResult.payer) {
        const txBytes = Buffer.from(suiPayload.transaction, "base64");
        const { signature: facilitatorSig } = await this.signer.signTransaction(txBytes);
        signatures.push(facilitatorSig);
      }

      // Execute the transaction with all signatures
      const execResult = await this.signer.executeTransaction(suiPayload.transaction, signatures);

      // Wait for confirmation
      const confirmed = await this.signer.waitForTransaction(execResult.digest);

      const status = confirmed.effects?.status.status;
      if (status !== "success") {
        return {
          success: false,
          errorReason: "execution_failed",
          errorMessage: `Transaction execution failed with status: ${status}`,
          payer: verifyResult.payer,
          transaction: execResult.digest,
          network: requirements.network,
        };
      }

      return {
        success: true,
        payer: verifyResult.payer,
        transaction: execResult.digest,
        network: requirements.network,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown settlement error";
      return {
        success: false,
        errorReason: "settlement_error",
        errorMessage: message,
        payer: verifyResult.payer,
        transaction: "",
        network: requirements.network,
      };
    }
  }
}

function invalid(reason: string, message: string): VerifyResponse {
  return {
    isValid: false,
    invalidReason: reason,
    invalidMessage: message,
  };
}
