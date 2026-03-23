import type { SuiJsonRpcClient } from "@mysten/sui/jsonRpc";

export interface CoinMetadataInfo {
  decimals: number;
  symbol: string;
  name: string;
}

export class CoinMetadataCache {
  private readonly cache = new Map<string, CoinMetadataInfo>();

  constructor(private readonly client: SuiJsonRpcClient) {}

  async getDecimals(coinType: string): Promise<number> {
    const metadata = await this.getMetadata(coinType);
    return metadata.decimals;
  }

  async getMetadata(coinType: string): Promise<CoinMetadataInfo> {
    const cached = this.cache.get(coinType);
    if (cached) {
      return cached;
    }

    const coinMetadata = await this.client.getCoinMetadata({ coinType });

    if (!coinMetadata) {
      throw new Error(`No metadata found for coin type: ${coinType}`);
    }

    const info: CoinMetadataInfo = {
      decimals: coinMetadata.decimals,
      symbol: coinMetadata.symbol,
      name: coinMetadata.name,
    };

    this.cache.set(coinType, info);
    return info;
  }

  clearCache(): void {
    this.cache.clear();
  }
}
