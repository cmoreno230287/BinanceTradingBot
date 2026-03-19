import crypto from 'node:crypto';
import { AppConfig } from '../config/app-config';
import { TradeSetup } from '../core/types';
import { BotStateStore } from '../infra/fs/bot-state-store';
import { TradeJournal } from '../infra/fs/trade-journal';

export class OrderGuardService {
  public constructor(
    private readonly stateStore: BotStateStore,
    private readonly tradeJournal: TradeJournal
  ) {}

  public getBlockReason(setup: TradeSetup, config: AppConfig, now: Date): string | null {
    const tradesToday = this.tradeJournal.countEntriesForDate(now);
    if (tradesToday >= config.maxTradesPerDay) {
      return `Daily trade limit reached (${tradesToday}/${config.maxTradesPerDay}).`;
    }

    if (this.stateStore.hasRecentOrder(setup.setupId, config.duplicateOrderCooldownMinutes, now)) {
      return `Duplicate setup blocked during ${config.duplicateOrderCooldownMinutes} minute cooldown.`;
    }

    return null;
  }

  public buildBracketId(setup: TradeSetup): string {
    const hash = crypto.createHash('sha256')
      .update(`${setup.setupId}|${setup.symbol}|${setup.direction}|${setup.entryPrice.toFixed(2)}`)
      .digest('hex');

    return `bot-${hash.slice(0, 16)}`;
  }

  public markOrderSubmitted(setup: TradeSetup, bracketId: string, now: Date): void {
    this.stateStore.addRecentOrder({
      setupId: setup.setupId,
      bracketId,
      createdAtIso: now.toISOString(),
      symbol: setup.symbol,
      direction: setup.direction,
      entryPrice: setup.entryPrice
    });
  }
}
