import { Candle, OpenTradeRecord } from '../core/types';
import { TradePerformanceStore } from '../infra/fs/trade-performance-store';
import { TradeJournal } from '../infra/fs/trade-journal';

export class TradeOutcomeService {
  public constructor(
    private readonly performanceStore: TradePerformanceStore,
    private readonly tradeJournal: TradeJournal
  ) {}

  public reconcileOpenTrades(symbol: string, entryCandles: Candle[], now: Date): OpenTradeRecord[] {
    const openTrades = this.performanceStore.getOpenTrades()
      .filter((record) => record.symbol === symbol && record.outcomeStatus === 'OPEN');

    const closedTrades: OpenTradeRecord[] = [];

    for (const trade of openTrades) {
      const outcome = this.resolveOutcome(trade, entryCandles, now);
      if (!outcome) {
        continue;
      }

      const closedTrade = {
        ...trade,
        closedAtIso: now.toISOString(),
        outcomeStatus: outcome
      } satisfies OpenTradeRecord;
      this.performanceStore.closeTrade(trade.setupId, now.toISOString(), outcome);
      this.tradeJournal.updateResultForTrade(closedTrade);
      closedTrades.push(closedTrade);
    }

    return closedTrades;
  }

  public registerOpenTrade(record: OpenTradeRecord): void {
    this.performanceStore.addOpenTrade(record);
  }

  private resolveOutcome(record: OpenTradeRecord, entryCandles: Candle[], now: Date): 'TP' | 'SL' | null {
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

function resolveAmbiguousSameCandleOutcome(record: OpenTradeRecord, candle: Candle): 'TP' | 'SL' {
  const distanceToStop = record.direction === 'BUY'
    ? Math.abs(candle.open - record.stopLossPrice)
    : Math.abs(record.stopLossPrice - candle.open);
  const distanceToTarget = record.direction === 'BUY'
    ? Math.abs(record.takeProfitPrice - candle.open)
    : Math.abs(candle.open - record.takeProfitPrice);

  return distanceToStop <= distanceToTarget ? 'SL' : 'TP';
}
