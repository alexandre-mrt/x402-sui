import type { x402ResourceServer } from "@x402/core/server";
import type { MoneyParser, Network } from "@x402/core/types";
import { ExactSuiServerScheme } from "./scheme.js";

export interface SuiResourceServerConfig {
  networks?: Network[];
  moneyParsers?: MoneyParser[];
}

export function registerExactSuiScheme(
  server: x402ResourceServer,
  config: SuiResourceServerConfig = {},
): x402ResourceServer {
  const scheme = new ExactSuiServerScheme(config.moneyParsers);

  if (config.networks && config.networks.length > 0) {
    for (const network of config.networks) {
      server.register(network, scheme);
    }
  } else {
    server.register("sui:*" as Network, scheme);
  }

  return server;
}
