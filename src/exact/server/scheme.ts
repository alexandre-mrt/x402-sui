import type {
  AssetAmount,
  MoneyParser,
  Network,
  PaymentRequirements,
  Price,
  SchemeNetworkServer,
} from "@x402/core/types";
import { USDC_DECIMALS } from "../../constants.js";
import { convertToTokenAmount, getUsdcCoinType, normalizeNetwork } from "../../utils.js";

export class ExactSuiServerScheme implements SchemeNetworkServer {
  readonly scheme = "exact";

  constructor(private readonly moneyParsers: MoneyParser[] = []) {}

  async parsePrice(price: Price, network: Network): Promise<AssetAmount> {
    normalizeNetwork(network);

    // If price is already an AssetAmount, return it directly
    if (typeof price === "object" && "asset" in price && "amount" in price) {
      return price;
    }

    // Try custom money parsers first
    const numericAmount = typeof price === "string" ? Number.parseFloat(price) : price;

    for (const parser of this.moneyParsers) {
      const result = await parser(numericAmount, network);
      if (result !== null) {
        return result;
      }
    }

    // Default: treat as USD amount, convert to USDC
    const usdcCoinType = getUsdcCoinType(network);
    const amount = convertToTokenAmount(String(numericAmount), USDC_DECIMALS);

    return {
      asset: usdcCoinType,
      amount,
    };
  }

  async enhancePaymentRequirements(
    paymentRequirements: PaymentRequirements,
    supportedKind: {
      x402Version: number;
      scheme: string;
      network: Network;
      extra?: Record<string, unknown>;
    },
    _facilitatorExtensions: string[],
  ): Promise<PaymentRequirements> {
    // Inject facilitator's gas station URL if available (per Sui x402 spec)
    const gasStation = supportedKind.extra?.gasStation;

    return {
      ...paymentRequirements,
      extra: {
        ...paymentRequirements.extra,
        ...(typeof gasStation === "string" ? { gasStation } : {}),
      },
    };
  }
}
