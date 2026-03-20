import { loadAppConfig } from './config/app-config';
import { BinanceCliOrderExecutor } from './infra/binance/binance-cli-order-executor';
import { BinanceMarketDataClient } from './infra/binance/binance-market-data-client';
import { BotLogger } from './infra/fs/bot-logger';
import { BotStateStore } from './infra/fs/bot-state-store';
import { TradePerformanceStore } from './infra/fs/trade-performance-store';
import { StrategyLoader } from './infra/fs/strategy-loader';
import { TradeJournal } from './infra/fs/trade-journal';
import { BotRunner } from './services/bot-runner';
import { OrderGuardService } from './services/order-guard-service';
import { PositionSizingService } from './services/position-sizing-service';
import { TradeOutcomeService } from './services/trade-outcome-service';
import { TradingBotService } from './services/trading-bot-service';

async function main(): Promise<void> {
  const config = loadAppConfig();
  const marketDataClient = new BinanceMarketDataClient(config.binanceBaseUrl);
  const strategyLoader = new StrategyLoader(config.strategiesDirectoryPath);
  const tradeJournal = new TradeJournal(config.tradeJournalDirectoryPath);
  const orderExecutor = new BinanceCliOrderExecutor(config.binanceCliExecutablePath);
  const positionSizingService = new PositionSizingService();
  const stateStore = new BotStateStore(config.stateDirectoryPath);
  const logger = new BotLogger(config.logsDirectoryPath);
  const orderGuardService = new OrderGuardService(stateStore, tradeJournal);
  const tradePerformanceStore = new TradePerformanceStore(config.stateDirectoryPath, config.reportsDirectoryPath);
  const tradeOutcomeService = new TradeOutcomeService(tradePerformanceStore);

  const service = new TradingBotService({
    config,
    marketDataClient,
    strategyLoader,
    tradeJournal,
    orderExecutor,
    positionSizingService,
    orderGuardService,
    tradeOutcomeService,
    logger
  });
  const runner = new BotRunner(service, config.analysisIntervalSeconds, logger);
  await runner.run();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
