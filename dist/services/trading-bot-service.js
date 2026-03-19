"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradingBotService = void 0;
const smc_liquidity_sweep_strategy_1 = require("../strategies/smc-liquidity-sweep-strategy");
class TradingBotService {
    dependencies;
    constructor(dependencies) {
        this.dependencies = dependencies;
    }
    async runOnce() {
        const { config, marketDataClient, strategyLoader, tradeJournal, orderExecutor, positionSizingService, orderGuardService, logger } = this.dependencies;
        const strategyDefinition = strategyLoader.loadById(config.strategyId);
        const now = new Date();
        const [contextCandles, executionCandles, entryCandles] = await Promise.all([
            marketDataClient.getCandles(strategyDefinition.symbol, strategyDefinition.contextInterval, strategyDefinition.candlesLimit),
            marketDataClient.getCandles(strategyDefinition.symbol, strategyDefinition.executionInterval, strategyDefinition.candlesLimit),
            marketDataClient.getCandles(strategyDefinition.symbol, strategyDefinition.entryInterval, strategyDefinition.candlesLimit)
        ]);
        const strategy = new smc_liquidity_sweep_strategy_1.SmcLiquiditySweepStrategy();
        const analysis = strategy.analyze({
            strategy: strategyDefinition,
            contextCandles,
            executionCandles,
            entryCandles,
            symbol: config.binanceSymbol
        });
        if (!analysis.shouldPlaceOrder || !analysis.setup) {
            logger.info('Analysis completed without valid setup.', { strategyId: strategyDefinition.id, reasons: analysis.reasons });
            return {
                botName: config.botName,
                analysis,
                order: {
                    executed: false,
                    reason: 'No valid setup matched the active strategy.'
                }
            };
        }
        if (!config.executeOrders) {
            logger.info('Execution skipped because live execution is disabled.', { setupId: analysis.setup.setupId });
            return {
                botName: config.botName,
                analysis,
                order: {
                    executed: false,
                    reason: 'Execution disabled by EXECUTE_ORDERS=false.'
                }
            };
        }
        const guardReason = orderGuardService.getBlockReason(analysis.setup, config, now);
        if (guardReason) {
            logger.info('Execution blocked by guard rules.', { setupId: analysis.setup.setupId, reason: guardReason });
            return {
                botName: config.botName,
                analysis,
                order: {
                    executed: false,
                    reason: guardReason
                }
            };
        }
        const positionSizing = positionSizingService.calculateQuantity(analysis.setup, config, strategyDefinition.defaultQuantity || config.defaultQuantity);
        const bracketId = orderGuardService.buildBracketId(analysis.setup);
        const executionResult = await orderExecutor.placeBracketOrder({
            setup: analysis.setup,
            bracketId,
            quantity: positionSizing.quantity,
            useTestOrders: config.useTestOrders
        });
        const dateFormatter = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' });
        const timeFormatter = new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'America/Bogota'
        });
        tradeJournal.append({
            date: dateFormatter.format(now),
            time: timeFormatter.format(now),
            session: analysis.session,
            direction: analysis.setup.direction,
            htfContext: analysis.setup.context,
            sweptLiquidity: analysis.setup.sweptLiquidity,
            confirmationType: analysis.setup.confirmationType,
            entryZone: `${analysis.setup.entryZoneType}: ${analysis.setup.entryZoneDescription}`,
            stopLoss: analysis.setup.stopLossPrice,
            takeProfit: analysis.setup.takeProfitPrice,
            riskRewardRatio: analysis.setup.riskRewardRatio,
            result: config.useTestOrders ? 'TestValidated' : 'Submitted'
        }, now);
        orderGuardService.markOrderSubmitted(analysis.setup, bracketId, now);
        logger.info('Order submitted through Binance CLI.', {
            setupId: analysis.setup.setupId,
            bracketId,
            quantity: positionSizing.quantity,
            useTestOrders: config.useTestOrders
        });
        return {
            botName: config.botName,
            analysis,
            positionSizing,
            bracketId,
            order: executionResult
        };
    }
}
exports.TradingBotService = TradingBotService;
//# sourceMappingURL=trading-bot-service.js.map