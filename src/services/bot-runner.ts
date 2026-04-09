import { TradingBotService } from './trading-bot-service';
import { BotLogger } from '../infra/fs/bot-logger';

export class BotRunner {
  public constructor(
    private readonly tradingBotService: TradingBotService,
    private readonly analysisIntervalSeconds: number,
    private readonly logger?: BotLogger
  ) {}

  public async run(): Promise<void> {
    let firstSubmittedTradeSetupId: string | null = null;

    if (this.analysisIntervalSeconds <= 0) {
      const summary = await this.tradingBotService.runOnce();
      clearConsole();
      console.log(formatConsoleSummary(summary));
      return;
    }

    for (;;) {
      const startedAt = new Date().toISOString();

      try {
        const summary = await this.tradingBotService.runOnce();
        if (!firstSubmittedTradeSetupId && typeof summary.submittedTradeSetupId === 'string') {
          firstSubmittedTradeSetupId = summary.submittedTradeSetupId;
        }

        this.logger?.info('Trading cycle completed.', summary);
        clearConsole();
        console.log(formatConsoleSummary({ startedAt, ...summary }));

        if (shouldStopAfterFirstTradeWinner(summary, firstSubmittedTradeSetupId)) {
          this.logger?.info('Bot runner stopped because first submitted trade closed as winner.', {
            firstSubmittedTradeSetupId
          });
          break;
        }
      } catch (error: unknown) {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        this.logger?.error('Trading cycle failed.', { error: message });
        clearConsole();
        console.error(JSON.stringify({ startedAt, error: message }, null, 2));
      }

      await delay(this.analysisIntervalSeconds * 1000);
    }
  }
}

function clearConsole(): void {
  process.stdout.write('\x1Bc');
}

function formatConsoleSummary(summary: Record<string, unknown>): string {
  const analysis = isRecord(summary.analysis) ? summary.analysis : {};
  const reasons = Array.isArray(analysis.reasons) ? analysis.reasons.filter((item): item is string => typeof item === 'string') : [];
  const order = isRecord(summary.order) ? summary.order : {};

  const lines = [
    `Active Trade = ${summary.activeTrade === true ? 'true' : 'false'}`,
    `Active Trades Count = ${toNumber(summary.activeTradesCount)}`,
    `Closed Trades Count = ${toNumber(summary.closedTradesCount)}`
  ];

  if (typeof summary.startedAt === 'string') {
    lines.push(`Cycle Started At = ${summary.startedAt}`);
  }

  if (typeof analysis.strategyName === 'string') {
    lines.push(`Strategy = ${analysis.strategyName}`);
  }

  if (typeof analysis.session === 'string') {
    lines.push(`Session = ${analysis.session}`);
  }

  if (typeof order.reason === 'string') {
    lines.push(`Status = ${order.reason}`);
  } else if (order.executed === true) {
    lines.push('Status = Order submitted');
  }

  if (reasons.length > 0) {
    lines.push(`Reason = ${reasons[0]}`);
  }

  return lines.join('\n');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function shouldStopAfterFirstTradeWinner(summary: Record<string, unknown>, firstSetupId: string | null): boolean {
  if (!firstSetupId) {
    return false;
  }

  const closedTrades = Array.isArray(summary.closedTrades) ? summary.closedTrades : [];

  return closedTrades.some((trade) =>
    isRecord(trade) &&
    trade.setupId === firstSetupId &&
    trade.outcomeStatus === 'TP'
  );
}
