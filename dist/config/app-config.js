"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadAppConfig = loadAppConfig;
const node_path_1 = __importDefault(require("node:path"));
const node_fs_1 = __importDefault(require("node:fs"));
const env_loader_1 = require("./env-loader");
function loadAppConfig() {
    const projectRootPath = resolveProjectRootPath();
    const envFilePath = node_path_1.default.join(projectRootPath, '.env');
    const env = (0, env_loader_1.loadEnvFile)(envFilePath);
    return {
        botName: getString(env, 'BOT_NAME', 'BinanceTradingBot_V2'),
        strategyId: getString(env, 'STRATEGY_ID'),
        binanceSymbol: getString(env, 'BINANCE_SYMBOL', 'BTCUSDT'),
        binanceBaseUrl: getString(env, 'BINANCE_BASE_URL', 'https://api.binance.com'),
        binanceCliExecutablePath: getString(env, 'BINANCE_CLI_PATH', 'C:\\Projects\\BinanceIntegration\\BinanceIntegration.Cli\\bin\\Release\\net8.0\\BinanceIntegration.Cli.exe'),
        tradeJournalDirectoryPath: getString(env, 'TRADE_JOURNAL_DIR', 'C:\\Codex\\Agents\\Expert_Trader\\Resources\\Trades'),
        strategiesDirectoryPath: node_path_1.default.join(projectRootPath, 'strategies'),
        stateDirectoryPath: node_path_1.default.join(projectRootPath, 'state'),
        logsDirectoryPath: node_path_1.default.join(projectRootPath, 'logs'),
        reportsDirectoryPath: node_path_1.default.join(projectRootPath, 'reports'),
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
function resolveProjectRootPath() {
    const candidates = [
        node_path_1.default.resolve(__dirname, '..', '..'),
        node_path_1.default.resolve(__dirname, '..'),
        process.cwd()
    ];
    for (const candidate of candidates) {
        if (node_fs_1.default.existsSync(node_path_1.default.join(candidate, '.env')) || node_fs_1.default.existsSync(node_path_1.default.join(candidate, 'strategies'))) {
            return candidate;
        }
    }
    return node_path_1.default.resolve(__dirname, '..', '..');
}
function getString(source, key, fallback) {
    const value = source[key] ?? process.env[key] ?? fallback;
    if (!value) {
        throw new Error(`Missing required configuration value: ${key}`);
    }
    return value;
}
function getNumber(source, key, fallback) {
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
function getBoolean(source, key, fallback) {
    const rawValue = source[key] ?? process.env[key];
    if (!rawValue) {
        return fallback;
    }
    return rawValue.trim().toLowerCase() === 'true';
}
//# sourceMappingURL=app-config.js.map