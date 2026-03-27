import { Candle } from '../../core/types';

const REQUEST_TIMEOUT_MS = 10000;
const MAX_ATTEMPTS_PER_ENDPOINT = 2;
const FALLBACK_BASE_URLS = [
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
  'https://data-api.binance.vision'
];

export class BinanceMarketDataClient {
  public constructor(private readonly baseUrl: string) {}

  public async getCandles(symbol: string, interval: string, limit: number): Promise<Candle[]> {
    const endpointErrors: string[] = [];
    const baseUrls = this.resolveBaseUrls();

    for (const baseUrl of baseUrls) {
      const url = new URL('/api/v3/klines', baseUrl);
      url.searchParams.set('symbol', symbol);
      url.searchParams.set('interval', interval);
      url.searchParams.set('limit', String(limit));

      for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_ENDPOINT; attempt += 1) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

        try {
          const response = await fetch(url, { signal: controller.signal });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }

          const payload = (await response.json()) as unknown[];
          return payload.map((item) => {
            const values = item as Array<number | string>;
            return {
              openTime: Number(values[0]),
              open: Number(values[1]),
              high: Number(values[2]),
              low: Number(values[3]),
              close: Number(values[4]),
              volume: Number(values[5]),
              closeTime: Number(values[6])
            } satisfies Candle;
          });
        } catch (error) {
          endpointErrors.push(`${baseUrl} (attempt ${attempt}/${MAX_ATTEMPTS_PER_ENDPOINT}): ${formatError(error)}`);
        } finally {
          clearTimeout(timeoutId);
        }
      }
    }

    throw new Error(
      `Failed to fetch Binance candles for ${symbol} ${interval}. ${endpointErrors.join(' | ')}`
    );
  }

  private resolveBaseUrls(): string[] {
    const unique = new Set<string>([this.baseUrl.trim(), ...FALLBACK_BASE_URLS]);
    return Array.from(unique).filter((value) => value.length > 0);
  }
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return `timeout after ${REQUEST_TIMEOUT_MS}ms`;
    }

    return error.message;
  }

  return String(error);
}
