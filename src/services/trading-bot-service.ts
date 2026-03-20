import { AppConfig } from '../config/app-config';
import { BinanceCliOrderExecutor } from '../infra/binance/binance-cli-order-executor';
import { BinanceMarketDataClient } from '../infra/binance/binance-market-data-client';
import { BotLogger } from '../infra/fs/bot-logger';
import { TradePerformanceStore } from '../infra/fs/trade-performance-store';
import { StrategyLoader } from '../infra/fs/strategy-loader';
import { TradeJournal } from '../infra/fs/trade-journal';
import { OrderGuardService } from './order-guard-service';
import { PositionSizingService } from './position-sizing-service';
import { TradeOutcomeService } from './trade-outcome-service';
import { SmcLiquiditySweepStrategy } from '../strategies/smc-liquidity-sweep-strategy';

interface TradingBotServiceDependencies {
  config: AppConfig;
  marketDataClient: BinanceMarketDataClient;
  strategyLoader: StrategyLoader;
  tradeJournal: TradeJournal;
  orderExecutor: BinanceCliOrderExecutor;
  positionSizingService: PositionSizingService;
  orderGuardService: OrderGuardService;
  tradeOutcomeService: TradeOutcomeService;
  logger: BotLogger;
}

export class TradingBotService {
  public constructor(private readonly dependencies: TradingBotServiceDependencies) {}

  public async runOnce(): Promise<Record<string, unknown>> {
    const {
      config,
      marketDataClient,
      strategyLoader,
      tradeJournal,
      orderExecutor,
      positionSizingService,
      orderGuardService,
      tradeOutcomeService,
      logger
    } = this.dependencies;
    const strategyDefinition = strategyLoader.loadById(config.strategyId);
    const now = new Date();

    const [contextCandles, executionCandles, entryCandles] = await Promise.all([
      marketDataClient.getCandles(strategyDefinition.symbol, strategyDefinition.contextInterval, strategyDefinition.candlesLimit),
      marketDataClient.getCandles(strategyDefinition.symbol, strategyDefinition.executionInterval, strategyDefinition.candlesLimit),
      marketDataClient.getCandles(strategyDefinition.symbol, strategyDefinition.entryInterval, strategyDefinition.candlesLimit)
    ]);

    const strategy = new SmcLiquiditySweepStrategy();
    const closedTrades = tradeOutcomeService.reconcileOpenTrades(config.binanceSymbol, entryCandles, now);
    if (closedTrades.length > 0) {
      logger.info('Open test trades reconciled to final outcomes.', closedTrades);
    }

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

    const positionSizing = positionSizingService.calculateQuantity(
      analysis.setup,
      config,
      strategyDefinition.defaultQuantity || config.defaultQuantity
    );
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

    if (config.useTestOrders) {
      tradeOutcomeService.registerOpenTrade({
        setupId: analysis.setup.setupId,
        bracketId,
        strategyId: strategyDefinition.id,
        symbol: analysis.setup.symbol,
        session: analysis.session,
        direction: analysis.setup.direction,
        entryPrice: analysis.setup.entryPrice,
        stopLossPrice: analysis.setup.stopLossPrice,
        takeProfitPrice: analysis.setup.takeProfitPrice,
        riskRewardRatio: analysis.setup.riskRewardRatio,
        executionMode: 'TEST',
        openedAtIso: now.toISOString(),
        outcomeStatus: 'OPEN'
      });
    }

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
      closedTrades,
      positionSizing,
      bracketId,
      order: executionResult
    };
  }
}
