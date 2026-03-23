import type { x402Facilitator } from "@x402/core/facilitator";
import type { Network } from "@x402/core/types";
import { SettlementCache } from "../../settlement-cache.js";
import type { FacilitatorSuiSigner } from "../../signer.js";
import { ExactSuiFacilitatorScheme } from "./scheme.js";

export interface SuiFacilitatorConfig {
  signer: FacilitatorSuiSigner;
  networks: Network | Network[];
}

export function registerExactSuiScheme(
  facilitator: x402Facilitator,
  config: SuiFacilitatorConfig,
): x402Facilitator {
  const settlementCache = new SettlementCache();
  const scheme = new ExactSuiFacilitatorScheme(config.signer, settlementCache);

  facilitator.register(config.networks, scheme);

  return facilitator;
}
