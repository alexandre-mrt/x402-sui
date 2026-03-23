import type { PaymentPolicy, SelectPaymentRequirements, x402Client } from "@x402/core/client";
import type { Network } from "@x402/core/types";
import type { ClientSuiConfig, ClientSuiSigner } from "../../signer.js";
import { ExactSuiClientScheme } from "./scheme.js";

export interface SuiClientConfig {
  signer: ClientSuiSigner;
  paymentRequirementsSelector?: SelectPaymentRequirements;
  policies?: PaymentPolicy[];
  networks?: Network[];
  rpcUrl?: string;
}

export function registerExactSuiScheme(client: x402Client, config: SuiClientConfig): x402Client {
  const clientConfig: ClientSuiConfig = { rpcUrl: config.rpcUrl };
  const scheme = new ExactSuiClientScheme(config.signer, clientConfig);

  if (config.networks && config.networks.length > 0) {
    for (const network of config.networks) {
      client.register(network, scheme);
    }
  } else {
    client.register("sui:*" as Network, scheme);
  }

  if (config.policies) {
    for (const policy of config.policies) {
      client.registerPolicy(policy);
    }
  }

  return client;
}
