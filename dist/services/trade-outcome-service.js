"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeOutcomeService = void 0;
class TradeOutcomeService {
    performanceStore;
    tradeJournal;
    constructor(performanceStore, tradeJournal) {
        this.performanceStore = performanceStore;
        this.tradeJournal = tradeJournal;
    }
    reconcileOpenTrades(symbol, entryCandles, now) {
        const openTrades = this.performanceStore.getOpenTrades()
            .filter((record) => record.symbol === symbol && record.outcomeStatus === 'OPEN');
        const closedTrades = [];
        for (const trade of openTrades) {
            const outcome = this.resolveOutcome(trade, entryCandles, now);
            if (!outcome) {
                continue;
            }
            const closedTrade = {
                ...trade,
                closedAtIso: now.toISOString(),
                outcomeStatus: outcome
            };
            this.performanceStore.closeTrade(trade.setupId, now.toISOString(), outcome);
            this.tradeJournal.updateResultForTrade(closedTrade);
            closedTrades.push(closedTrade);
        }
        return closedTrades;
    }
    registerOpenTrade(record) {
        this.performanceStore.addOpenTrade(record);
    }
    resolveOutcome(record, entryCandles, now) {
        const relevantCandles = entryCandles.filter((candle) => candle.closeTime > new Date(record.openedAtIso).getTime());
        if (relevantCandles.length === 0) {
            return null;
        }
        for (const candle of relevantCandles) {
            if (record.direction === 'BUY') {
                const hitStop = candle.low <= record.stopLossPrice;
                const hitTarget = candle.high >= record.takeProfitPrice;
                if (hitStop && hitTarget) {
                    return resolveAmbiguousSameCandleOutcome(record, candle);
                }
                if (hitStop) {
                    return 'SL';
                }
                if (hitTarget) {
                    return 'TP';
                }
                continue;
            }
            const hitStop = candle.high >= record.stopLossPrice;
            const hitTarget = candle.low <= record.takeProfitPrice;
            if (hitStop && hitTarget) {
                return resolveAmbiguousSameCandleOutcome(record, candle);
            }
            if (hitStop) {
                return 'SL';
            }
            if (hitTarget) {
                return 'TP';
            }
        }
        return null;
    }
}
exports.TradeOutcomeService = TradeOutcomeService;
function resolveAmbiguousSameCandleOutcome(record, candle) {
    const distanceToStop = record.direction === 'BUY'
        ? Math.abs(candle.open - record.stopLossPrice)
        : Math.abs(record.stopLossPrice - candle.open);
    const distanceToTarget = record.direction === 'BUY'
        ? Math.abs(record.takeProfitPrice - candle.open)
        : Math.abs(candle.open - record.takeProfitPrice);
    return distanceToStop <= distanceToTarget ? 'SL' : 'TP';
}
//# sourceMappingURL=trade-outcome-service.js.map