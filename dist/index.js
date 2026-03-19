"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const app_config_1 = require("./config/app-config");
const binance_cli_order_executor_1 = require("./infra/binance/binance-cli-order-executor");
const binance_market_data_client_1 = require("./infra/binance/binance-market-data-client");
const bot_logger_1 = require("./infra/fs/bot-logger");
const bot_state_store_1 = require("./infra/fs/bot-state-store");
const strategy_loader_1 = require("./infra/fs/strategy-loader");
const trade_journal_1 = require("./infra/fs/trade-journal");
const bot_runner_1 = require("./services/bot-runner");
const order_guard_service_1 = require("./services/order-guard-service");
const position_sizing_service_1 = require("./services/position-sizing-service");
const trading_bot_service_1 = require("./services/trading-bot-service");
async function main() {
    const config = (0, app_config_1.loadAppConfig)();
    const marketDataClient = new binance_market_data_client_1.BinanceMarketDataClient(config.binanceBaseUrl);
    const strategyLoader = new strategy_loader_1.StrategyLoader(config.strategiesDirectoryPath);
    const tradeJournal = new trade_journal_1.TradeJournal(config.tradeJournalDirectoryPath);
    const orderExecutor = new binance_cli_order_executor_1.BinanceCliOrderExecutor(config.binanceCliExecutablePath);
    const positionSizingService = new position_sizing_service_1.PositionSizingService();
    const stateStore = new bot_state_store_1.BotStateStore(config.stateDirectoryPath);
    const logger = new bot_logger_1.BotLogger(config.logsDirectoryPath);
    const orderGuardService = new order_guard_service_1.OrderGuardService(stateStore, tradeJournal);
    const service = new trading_bot_service_1.TradingBotService({
        config,
        marketDataClient,
        strategyLoader,
        tradeJournal,
        orderExecutor,
        positionSizingService,
        orderGuardService,
        logger
    });
    const runner = new bot_runner_1.BotRunner(service, config.analysisIntervalSeconds, logger);
    await runner.run();
}
main().catch((error) => {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
});
//# sourceMappingURL=index.js.map