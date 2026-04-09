import path from 'node:path';
import fs from 'node:fs';
import { loadEnvFile } from './env-loader';

export interface AppConfig {
  botName: string;
  strategyId: string;
  binanceSymbol: string;
  binanceBaseUrl: string;
  binanceCliExecutablePath: string;
  tradeJournalDirectoryPath: string;
  strategiesDirectoryPath: string;
  stateDirectoryPath: string;
  logsDirectoryPath: string;
  reportsDirectoryPath: string;
  riskPercent: number;
  accountBalanceUsd: number;
  defaultQuantity: number;
  minQuantity: number;
  maxQuantity: number;
  maxTradesPerDay: number;
  maxOrdersActive: number;
  duplicateOrderCooldownMinutes: number;
  executeOrders: boolean;
  useTestOrders: boolean;
  analysisIntervalSeconds: number;
}

export function loadAppConfig(): AppConfig {
  const projectRootPath = resolveProjectRootPath();
  const envFilePath = path.join(projectRootPath, '.env');
  const env = loadEnvFile(envFilePath);

  return {
    botName: getString(env, 'BOT_NAME', 'BinanceTradingBot_V2'),
    strategyId: getString(env, 'STRATEGY_ID'),
    binanceSymbol: getString(env, 'BINANCE_SYMBOL', 'BTCUSDT'),
    binanceBaseUrl: getString(env, 'BINANCE_BASE_URL', 'https://api.binance.com'),
    binanceCliExecutablePath: getString(
      env,
      'BINANCE_CLI_PATH',
      'C:\\Projects\\BinanceIntegration\\BinanceIntegration.Cli\\bin\\Release\\net8.0\\BinanceIntegration.Cli.exe'
    ),
    tradeJournalDirectoryPath: getString(
      env,
      'TRADE_JOURNAL_DIR',
      'C:\\Codex\\Agents\\Expert_Trader\\Resources\\Trades'
    ),
    strategiesDirectoryPath: path.join(projectRootPath, 'strategies'),
    stateDirectoryPath: path.join(projectRootPath, 'state'),
    logsDirectoryPath: path.join(projectRootPath, 'logs'),
    reportsDirectoryPath: path.join(projectRootPath, 'reports'),
    riskPercent: getNumber(env, 'RISK_PERCENT', 1),
    accountBalanceUsd: getNumber(env, 'ACCOUNT_BALANCE_USD', 1000),
    defaultQuantity: getNumber(env, 'DEFAULT_QUANTITY', 0.0001),
    minQuantity: getNumber(env, 'MIN_QUANTITY', 0.00001),
    maxQuantity: getNumber(env, 'MAX_QUANTITY', 1),
    maxTradesPerDay: getNumber(env, 'MAX_TRADES_PER_DAY', 3),
    maxOrdersActive: getNumber(env, 'MAX_ORDERS_ACTIVE', 1),
    duplicateOrderCooldownMinutes: getNumber(env, 'DUPLICATE_ORDER_COOLDOWN_MINUTES', 90),
    executeOrders: getBoolean(env, 'EXECUTE_ORDERS', false),
    useTestOrders: getBoolean(env, 'USE_TEST_ORDERS', true),
    analysisIntervalSeconds: getNumber(env, 'ANALYSIS_INTERVAL_SECONDS', 0)
  };
}

function resolveProjectRootPath(): string {
  const candidates = [
    path.resolve(__dirname, '..', '..'),
    path.resolve(__dirname, '..'),
    process.cwd()
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(path.join(candidate, '.env')) || fs.existsSync(path.join(candidate, 'strategies'))) {
      return candidate;
    }
  }

  return path.resolve(__dirname, '..', '..');
}

function getString(source: Record<string, string>, key: string, fallback?: string): string {
  const value = source[key] ?? process.env[key] ?? fallback;

  if (!value) {
    throw new Error(`Missing required configuration value: ${key}`);
  }

  return value;
}

function getNumber(source: Record<string, string>, key: string, fallback: number): number {
  const rawValue = source[key] ?? process.env[key];

  if (!rawValue) {
    return fallback;
  }

  const parsedValue = Number(rawValue);

  if (Number.isNaN(parsedValue)) {
    throw new Error(`Configuration value ${key} must be numeric.`);
  }

  return parsedValue;
}

function getBoolean(source: Record<string, string>, key: string, fallback: boolean): boolean {
  const rawValue = source[key] ?? process.env[key];

  if (!rawValue) {
    return fallback;
  }

  return rawValue.trim().toLowerCase() === 'true';
}
