import fs from 'node:fs';
import path from 'node:path';
import { loadAppConfig } from './config/app-config';
import { Candle, SessionName, TradeDirection, TradeSetup } from './core/types';
import { StrategyLoader } from './infra/fs/strategy-loader';
import { SmcLiquiditySweepStrategy } from './strategies/smc-liquidity-sweep-strategy';

const BINANCE_KLINES_PATH = '/api/v3/klines';
const REQUEST_TIMEOUT_MS = 15000;
const KLINES_LIMIT = 1000;
const FALLBACK_BASE_URLS = [
  'https://api1.binance.com',
  'https://api2.binance.com',
  'https://api3.binance.com',
  'https://data-api.binance.vision'
];
const JOURNAL_HEADER = 'Fecha,Hora,Sesion,Direccion,Contexto HTF,Nivel de liquidez barrido,Tipo de confirmacion,Zona de entrada,Stop Loss,Take Profit,R:R,Resultado';

interface BacktestArgs {
  strategyId?: string;
  symbol?: string;
  months: number;
  from?: number;
  to?: number;
  initialBalanceUsd?: number;
  riskPercent?: number;
}

interface SimulatedTrade {
  setupId: string;
  session: SessionName;
  direction: TradeDirection;
  signalTimeIso: string;
  exitTimeIso: string;
  outcome: 'TP' | 'SL';
  htfContext: string;
  sweptLiquidity: string;
  confirmationType: string;
  entryZone: string;
  stopLoss: number;
  takeProfit: number;
  riskReward: number;
  pnlR: number;
  riskAmountUsd: number;
  pnlUsd: number;
  balanceAfterUsd: number;
}

async function main(): Promise<void> {
  const config = loadAppConfig();
  const args = parseArgs(process.argv.slice(2));
  const strategyLoader = new StrategyLoader(config.strategiesDirectoryPath);
  const strategy = strategyLoader.loadById(args.strategyId ?? config.strategyId);
  const strategyEngine = new SmcLiquiditySweepStrategy();

  const symbol = args.symbol ?? strategy.symbol ?? config.binanceSymbol;
  const { fromTs, toTs } = resolveTimeRange(args.months, args.from, args.to);
  const initialBalanceUsd = args.initialBalanceUsd ?? config.accountBalanceUsd;
  const riskPercent = args.riskPercent ?? config.riskPercent;

  const baseUrls = resolveBaseUrls(config.binanceBaseUrl);
  console.log(
    `Running backtest for ${symbol} using strategy '${strategy.id}' from ${new Date(fromTs).toISOString()} to ${new Date(toTs).toISOString()}`
  );

  const [contextCandles, executionCandles, entryCandles] = await Promise.all([
    fetchCandlesRange(baseUrls, symbol, strategy.contextInterval, fromTs, toTs),
    fetchCandlesRange(baseUrls, symbol, strategy.executionInterval, fromTs, toTs),
    fetchCandlesRange(baseUrls, symbol, strategy.entryInterval, fromTs, toTs)
  ]);

  if (contextCandles.length < strategy.candlesLimit || executionCandles.length < strategy.candlesLimit || entryCandles.length < strategy.candlesLimit) {
    throw new Error('Not enough candles for backtest. Try a larger range or check network/API availability.');
  }

  let balanceUsd = initialBalanceUsd;
  let peakBalanceUsd = initialBalanceUsd;
  let maxDrawdownPercent = 0;
  let totalSignals = 0;
  let winners = 0;
  let losers = 0;
  let lastExitTime = 0;
  const trades: SimulatedTrade[] = [];

  for (let executionIndex = strategy.candlesLimit - 1; executionIndex < executionCandles.length; executionIndex += 1) {
    const executionCandle = executionCandles[executionIndex];
    if (executionCandle.closeTime <= lastExitTime) {
      continue;
    }

    const contextSlice = sliceCandlesByTime(contextCandles, executionCandle.closeTime, strategy.candlesLimit);
    const executionSlice = executionCandles.slice(Math.max(0, executionIndex - strategy.candlesLimit + 1), executionIndex + 1);
    const entrySlice = sliceCandlesByTime(entryCandles, executionCandle.closeTime, strategy.candlesLimit);

    if (contextSlice.length < strategy.candlesLimit || executionSlice.length < strategy.candlesLimit || entrySlice.length < strategy.candlesLimit) {
      continue;
    }

    const analysis = strategyEngine.analyze({
      strategy,
      symbol,
      contextCandles: contextSlice,
      executionCandles: executionSlice,
      entryCandles: entrySlice,
      analysisDate: new Date(executionCandle.closeTime)
    });

    if (!analysis.shouldPlaceOrder || !analysis.setup) {
      continue;
    }

    totalSignals += 1;
    const resolved = resolveTradeOutcome(analysis.setup, entryCandles, executionCandle.closeTime);
    if (!resolved) {
      continue;
    }

    const riskAmountUsd = balanceUsd * (riskPercent / 100);
    const pnlR = resolved.outcome === 'TP' ? analysis.setup.riskRewardRatio : -1;
    const pnlUsd = resolved.outcome === 'TP' ? riskAmountUsd * analysis.setup.riskRewardRatio : -riskAmountUsd;
    balanceUsd += pnlUsd;
    peakBalanceUsd = Math.max(peakBalanceUsd, balanceUsd);
    const drawdownPercent = peakBalanceUsd > 0 ? ((peakBalanceUsd - balanceUsd) / peakBalanceUsd) * 100 : 0;
    maxDrawdownPercent = Math.max(maxDrawdownPercent, drawdownPercent);

    if (resolved.outcome === 'TP') {
      winners += 1;
    } else {
      losers += 1;
    }

    trades.push({
      setupId: analysis.setup.setupId,
      session: analysis.session,
      direction: analysis.setup.direction,
      signalTimeIso: new Date(executionCandle.closeTime).toISOString(),
      exitTimeIso: new Date(resolved.exitTime).toISOString(),
      outcome: resolved.outcome,
      htfContext: analysis.setup.context,
      sweptLiquidity: analysis.setup.sweptLiquidity,
      confirmationType: analysis.setup.confirmationType,
      entryZone: `${analysis.setup.entryZoneType}: ${analysis.setup.entryZoneDescription}`,
      stopLoss: analysis.setup.stopLossPrice,
      takeProfit: analysis.setup.takeProfitPrice,
      riskReward: analysis.setup.riskRewardRatio,
      pnlR,
      riskAmountUsd,
      pnlUsd,
      balanceAfterUsd: balanceUsd
    });

    lastExitTime = resolved.exitTime;
  }

  const closedTrades = winners + losers;
  const winRate = closedTrades > 0 ? (winners / closedTrades) * 100 : 0;
  const totalR = trades.reduce((sum, trade) => sum + trade.pnlR, 0);
  const netPnlUsd = balanceUsd - initialBalanceUsd;

  const summary = {
    strategyId: strategy.id,
    symbol,
    range: {
      from: new Date(fromTs).toISOString(),
      to: new Date(toTs).toISOString(),
      months: args.months
    },
    candles: {
      context: contextCandles.length,
      execution: executionCandles.length,
      entry: entryCandles.length
    },
    results: {
      totalSignals,
      closedTrades,
      winners,
      losers,
      winRatePercent: Number(winRate.toFixed(2)),
      totalR: Number(totalR.toFixed(2)),
      initialBalanceUsd: Number(initialBalanceUsd.toFixed(2)),
      finalBalanceUsd: Number(balanceUsd.toFixed(2)),
      netPnlUsd: Number(netPnlUsd.toFixed(2)),
      maxDrawdownPercent: Number(maxDrawdownPercent.toFixed(2))
    }
  };

  const reportPaths = writeReport(config.reportsDirectoryPath, summary, trades);
  console.log(JSON.stringify({ summary, reportPaths }, null, 2));
}

function parseArgs(argv: string[]): BacktestArgs {
  const args: BacktestArgs = { months: 12 };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];

    if (current === '--strategy' && next) {
      args.strategyId = next;
      index += 1;
      continue;
    }

    if (current === '--symbol' && next) {
      args.symbol = next.toUpperCase();
      index += 1;
      continue;
    }

    if (current === '--months' && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.months = Math.floor(parsed);
      }
      index += 1;
      continue;
    }

    if (current === '--from' && next) {
      const parsed = Date.parse(next);
      if (Number.isFinite(parsed)) {
        args.from = parsed;
      }
      index += 1;
      continue;
    }

    if (current === '--to' && next) {
      const parsed = Date.parse(next);
      if (Number.isFinite(parsed)) {
        args.to = parsed;
      }
      index += 1;
      continue;
    }

    if (current === '--balance' && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.initialBalanceUsd = parsed;
      }
      index += 1;
      continue;
    }

    if (current === '--risk' && next) {
      const parsed = Number(next);
      if (Number.isFinite(parsed) && parsed > 0) {
        args.riskPercent = parsed;
      }
      index += 1;
      continue;
    }
  }

  return args;
}

function resolveTimeRange(months: number, from?: number, to?: number): { fromTs: number; toTs: number } {
  const toTs = to ?? Date.now();
  if (from) {
    return { fromTs: from, toTs };
  }

  const start = new Date(toTs);
  start.setUTCMonth(start.getUTCMonth() - months);
  return { fromTs: start.getTime(), toTs };
}

function resolveBaseUrls(primary: string): string[] {
  const unique = new Set<string>([primary.trim(), ...FALLBACK_BASE_URLS]);
  return Array.from(unique).filter((value) => value.length > 0);
}

async function fetchCandlesRange(
  baseUrls: string[],
  symbol: string,
  interval: string,
  fromTs: number,
  toTs: number
): Promise<Candle[]> {
  const intervalMs = intervalToMilliseconds(interval);
  let cursor = fromTs;
  const candles: Candle[] = [];

  while (cursor < toTs) {
    const payload = await fetchKlinesPage(baseUrls, symbol, interval, cursor, toTs);
    if (payload.length === 0) {
      break;
    }

    for (const item of payload) {
      const values = item as Array<number | string>;
      candles.push({
        openTime: Number(values[0]),
        open: Number(values[1]),
        high: Number(values[2]),
        low: Number(values[3]),
        close: Number(values[4]),
        volume: Number(values[5]),
        closeTime: Number(values[6])
      });
    }

    const lastOpenTime = Number(payload[payload.length - 1][0]);
    cursor = lastOpenTime + intervalMs;
    if (payload.length < KLINES_LIMIT) {
      break;
    }
  }

  return dedupeCandles(candles);
}

async function fetchKlinesPage(
  baseUrls: string[],
  symbol: string,
  interval: string,
  startTime: number,
  endTime: number
): Promise<unknown[][]> {
  const errors: string[] = [];

  for (const baseUrl of baseUrls) {
    const url = new URL(BINANCE_KLINES_PATH, baseUrl);
    url.searchParams.set('symbol', symbol);
    url.searchParams.set('interval', interval);
    url.searchParams.set('limit', String(KLINES_LIMIT));
    url.searchParams.set('startTime', String(startTime));
    url.searchParams.set('endTime', String(endTime));

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return (await response.json()) as unknown[][];
    } catch (error) {
      errors.push(`${baseUrl}: ${formatError(error)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error(`Unable to fetch ${interval} klines for ${symbol}. ${errors.join(' | ')}`);
}

function resolveTradeOutcome(
  setup: TradeSetup,
  entryCandles: Candle[],
  signalTime: number
): { outcome: 'TP' | 'SL'; exitTime: number } | null {
  for (const candle of entryCandles) {
    if (candle.openTime < signalTime) {
      continue;
    }

    if (setup.direction === 'BUY') {
      const slHit = candle.low <= setup.stopLossPrice;
      const tpHit = candle.high >= setup.takeProfitPrice;
      if (slHit && tpHit) {
        return { outcome: 'SL', exitTime: candle.closeTime };
      }
      if (slHit) {
        return { outcome: 'SL', exitTime: candle.closeTime };
      }
      if (tpHit) {
        return { outcome: 'TP', exitTime: candle.closeTime };
      }
      continue;
    }

    const slHit = candle.high >= setup.stopLossPrice;
    const tpHit = candle.low <= setup.takeProfitPrice;
    if (slHit && tpHit) {
      return { outcome: 'SL', exitTime: candle.closeTime };
    }
    if (slHit) {
      return { outcome: 'SL', exitTime: candle.closeTime };
    }
    if (tpHit) {
      return { outcome: 'TP', exitTime: candle.closeTime };
    }
  }

  return null;
}

function sliceCandlesByTime(candles: Candle[], closeTime: number, limit: number): Candle[] {
  const endIndex = findLastIndexByCloseTime(candles, closeTime);
  if (endIndex < 0) {
    return [];
  }

  const startIndex = Math.max(0, endIndex - limit + 1);
  return candles.slice(startIndex, endIndex + 1);
}

function findLastIndexByCloseTime(candles: Candle[], closeTime: number): number {
  let left = 0;
  let right = candles.length - 1;
  let result = -1;

  while (left <= right) {
    const middle = left + Math.floor((right - left) / 2);
    if (candles[middle].closeTime <= closeTime) {
      result = middle;
      left = middle + 1;
    } else {
      right = middle - 1;
    }
  }

  return result;
}

function dedupeCandles(candles: Candle[]): Candle[] {
  const map = new Map<number, Candle>();
  for (const candle of candles) {
    map.set(candle.openTime, candle);
  }

  return Array.from(map.values()).sort((a, b) => a.openTime - b.openTime);
}

function intervalToMilliseconds(interval: string): number {
  const match = interval.match(/^(\d+)([mhdw])$/i);
  if (!match) {
    throw new Error(`Unsupported interval format: ${interval}`);
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  const factors: Record<string, number> = {
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000
  };

  return value * factors[unit];
}

function writeReport(
  reportsDirectoryPath: string,
  summary: Record<string, unknown>,
  trades: SimulatedTrade[]
): { jsonPath: string; csvPath: string } {
  const directoryPath = path.join(reportsDirectoryPath, 'backtests');
  fs.mkdirSync(directoryPath, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const jsonPath = path.join(directoryPath, `backtest_${stamp}.json`);
  const csvPath = path.join(directoryPath, `backtest_${stamp}.csv`);

  fs.writeFileSync(jsonPath, JSON.stringify({ summary, trades }, null, 2), 'utf8');

  const lines = trades.map((trade) => {
    const signalTime = new Date(trade.signalTimeIso);
    const { date, time } = formatBogotaDateTime(signalTime);

    return [
      date,
      time,
      trade.session,
      trade.direction,
      csv(trade.htfContext),
      csv(trade.sweptLiquidity),
      trade.confirmationType,
      csv(trade.entryZone),
      trade.stopLoss.toFixed(2),
      trade.takeProfit.toFixed(2),
      trade.riskReward.toFixed(2),
      csv(trade.outcome)
    ].join(',');
  });
  fs.writeFileSync(csvPath, [JOURNAL_HEADER, ...lines].join('\n') + '\n', 'utf8');

  return { jsonPath, csvPath };
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'AbortError') {
      return `timeout after ${REQUEST_TIMEOUT_MS}ms`;
    }
    return error.message;
  }

  return String(error);
}

function formatBogotaDateTime(date: Date): { date: string; time: string } {
  const dateValue = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(date);
  const timeValue = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'America/Bogota'
  }).format(date);

  return { date: dateValue, time: timeValue };
}

function csv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exitCode = 1;
});
