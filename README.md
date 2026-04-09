# Binance Trading Bot

TypeScript trading bot for BTCUSDT that analyzes market structure and submits protected bracket orders through `BinanceIntegration.Cli.exe`.

## What It Does
- Loads a strategy from `strategies/*.json` using `STRATEGY_ID`.
- Fetches Binance candles (context, execution, entry timeframes).
- Runs SMC liquidity-sweep analysis.
- Applies risk management and guard rules before execution.
- Submits bracket orders with the external CLI.
- Tracks open/closed trades in local state/report files.

## Requirements
- Node.js 20+
- Built Binance Integration CLI executable (for example):
  `C:\BinanceIntegration-CLI\BinanceIntegration.Cli.exe`

## Setup
1. Copy `.env.example` to `.env`.
2. Configure `.env` values (`STRATEGY_ID`, CLI path, risk params, limits).
3. Install dependencies:
   `npm.cmd install`
4. Build:
   `npm.cmd run build`

## Run Commands
- Default mode (uses `.env` execution flags):
  `npm.cmd run start`
- Force real mode (submits live orders):
  `npm.cmd run start:real`
  or `node dist/index.js --real`
- Force test mode (submits with `--test`):
  `npm.cmd run start:test`
  or `node dist/index.js --test`
- Backtest:
  `npm.cmd run backtest -- --months 6`

`backtest-ab` is not supported.

## Key Environment Variables
- `STRATEGY_ID`: strategy id to load from `strategies/`.
- `BINANCE_CLI_PATH`: full path to `BinanceIntegration.Cli.exe`.
- `EXECUTE_ORDERS`: base execution toggle used when no mode flag is passed.
- `USE_TEST_ORDERS`: base test/live mode used when no mode flag is passed.
- `MAX_TRADES_PER_DAY`: max entries allowed per day.
- `MAX_ORDERS_ACTIVE`: max simultaneous open trades tracked by the bot.
- `DUPLICATE_ORDER_COOLDOWN_MINUTES`: duplicate setup cooldown.
- `ANALYSIS_INTERVAL_SECONDS`: `0` for one cycle, `>0` for continuous loop.
- `ACCOUNT_BALANCE_USD`, `RISK_PERCENT`, `MIN_QUANTITY`, `MAX_QUANTITY`: position sizing inputs.

## Behavior Notes
- The bot stops if the first submitted trade in the current process closes as `TP`.
- Open-trade tracking applies to both test and real execution modes.
- Logs are written to `logs\YYYYMMDD.log`.
- Trade lifecycle report is written to `reports\trade-performance-report.csv`.

## Additional Docs
- [TECHNICAL_WIKI.md](./TECHNICAL_WIKI.md)
- [EXECUTION_GUIDE.md](./EXECUTION_GUIDE.md)
- [EXECUTION_GUIDE.es.md](./EXECUTION_GUIDE.es.md)
