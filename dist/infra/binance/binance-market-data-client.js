"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinanceMarketDataClient = void 0;
class BinanceMarketDataClient {
    baseUrl;
    constructor(baseUrl) {
        this.baseUrl = baseUrl;
    }
    async getCandles(symbol, interval, limit) {
        const url = new URL('/api/v3/klines', this.baseUrl);
        url.searchParams.set('symbol', symbol);
        url.searchParams.set('interval', interval);
        url.searchParams.set('limit', String(limit));
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch Binance candles. Status: ${response.status}`);
        }
        const payload = (await response.json());
        return payload.map((item) => {
            const values = item;
            return {
                openTime: Number(values[0]),
                open: Number(values[1]),
                high: Number(values[2]),
                low: Number(values[3]),
                close: Number(values[4]),
                volume: Number(values[5]),
                closeTime: Number(values[6])
            };
        });
    }
}
exports.BinanceMarketDataClient = BinanceMarketDataClient;
//# sourceMappingURL=binance-market-data-client.js.map