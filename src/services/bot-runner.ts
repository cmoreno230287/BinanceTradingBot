import { TradingBotService } from './trading-bot-service';
import { BotLogger } from '../infra/fs/bot-logger';

export class BotRunner {
  public constructor(
    private readonly tradingBotService: TradingBotService,
    private readonly analysisIntervalSeconds: number,
    private readonly logger?: BotLogger
  ) {}

  public async run(): Promise<void> {
    if (this.analysisIntervalSeconds <= 0) {
      const summary = await this.tradingBotService.runOnce();
      console.log(JSON.stringify(summary, null, 2));
      return;
    }

    for (;;) {
      const startedAt = new Date().toISOString();

      try {
        const summary = await this.tradingBotService.runOnce();
        this.logger?.info('Trading cycle completed.', summary);
        console.log(JSON.stringify({ startedAt, ...summary }, null, 2));
      } catch (error: unknown) {
        const message = error instanceof Error ? error.stack ?? error.message : String(error);
        this.logger?.error('Trading cycle failed.', { error: message });
        console.error(JSON.stringify({ startedAt, error: message }, null, 2));
      }

      await delay(this.analysisIntervalSeconds * 1000);
    }
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}
