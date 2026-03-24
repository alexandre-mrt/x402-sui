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

export class ExactSuiFacilitatorScheme implements SchemeNetworkFacilitator {
  readonly scheme = "exact";
  readonly caipFamily = "sui:*";

  private readonly settlementCache: SettlementCache;

  constructor(
    private readonly signer: FacilitatorSuiSigner,
    settlementCache?: SettlementCache,
  ) {
    this.settlementCache = settlementCache ?? new SettlementCache();
  }

  getExtra(_network: Network): Record<string, unknown> | undefined {
    const addresses = this.signer.getAddresses();
    if (addresses.length === 0) return undefined;
    // Return a random gas owner address for load balancing
    const gasOwner = addresses[Math.floor(Math.random() * addresses.length)];
    return { gasOwner };
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
          BigInt(bc.amount) >= expectedAmount
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

      // Verify the transaction signer matches the payer (prevents signature substitution)
      if (payer && signerAddress !== payer) {
        return invalid(
          "signer_mismatch",
          `Transaction signer ${signerAddress} does not match payer ${payer}`,
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
    // First verify the payment
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

    const suiPayload = payload.payload as unknown as ExactSuiPayload;

    // Check for duplicate settlement (use decoded bytes to prevent base64 encoding variants bypass)
    const txDecoded = Buffer.from(suiPayload.transaction, "base64").toString("hex");
    const cacheKey = `${txDecoded}|${suiPayload.signature}`;
    if (this.settlementCache.isDuplicate(cacheKey)) {
      return {
        success: false,
        errorReason: "duplicate_settlement",
        errorMessage: "This payment has already been settled",
        payer: verifyResult.payer,
        transaction: "",
        network: requirements.network,
      };
    }

    try {
      // Collect signatures: client signature + optional facilitator co-signature for gas sponsorship
      const signatures = [suiPayload.signature];

      // Gas-sponsored transaction: facilitator co-signs only if gasOwner differs from payer
      const gasOwner = requirements.extra?.gasOwner;
      if (typeof gasOwner === "string" && verifyResult.payer && gasOwner !== verifyResult.payer) {
        // Security: verify the gasOwner is actually one of our addresses
        const facilitatorAddresses = this.signer.getAddresses();
        if (!facilitatorAddresses.includes(gasOwner)) {
          return {
            success: false,
            errorReason: "invalid_gas_owner",
            errorMessage: `Gas owner ${gasOwner} is not a known facilitator address`,
            payer: verifyResult.payer,
            transaction: "",
            network: requirements.network,
          };
        }

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
