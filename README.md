# Binance Trading Bot V2

TypeScript trading bot that:
- loads the active strategy from `.env`
- reads strategy definitions from the `strategies` folder
- fetches Binance candle data
- analyzes BTCUSDT using the configured strategy
- places protected bracket orders through `BinanceIntegration.Cli`
- sizes quantity from account risk and stop distance
- can run once or on a repeated analysis interval
- journals executed trades into monthly CSV files

## Execution Guides
- English: [EXECUTION_GUIDE.md](C:\Projects\BinanceTradingBot_V2\EXECUTION_GUIDE.md)
- Espanol: [EXECUTION_GUIDE.es.md](C:\Projects\BinanceTradingBot_V2\EXECUTION_GUIDE.es.md)

## Requirements
- Node.js 20+
- .NET Binance Integration CLI already built at:
  `C:\Projects\BinanceIntegration\BinanceIntegration.Cli\bin\Release\net8.0\BinanceIntegration.Cli.exe`

## Setup
1. Copy `.env.example` to `.env`.
2. Adjust `STRATEGY_ID`, execution flags, account risk values, and CLI path if needed.
3. Install dependencies:
   `npm.cmd install`
4. Build:
   `npm.cmd run build`
5. Run one analysis cycle:
   `npm.cmd run start`

## Key Environment Variables
- `STRATEGY_ID`: selects the strategy JSON from the `strategies` folder.
- `EXECUTE_ORDERS`: when `false`, the bot only analyzes and prints the setup result.
- `USE_TEST_ORDERS`: when `true`, submitted bracket orders include `--test`.
- `ACCOUNT_BALANCE_USD`: used with `RISK_PERCENT` to size BTC quantity from stop distance.
- `MAX_TRADES_PER_DAY`: blocks new submissions once the journal already contains that many trades for the day.
- `DUPLICATE_ORDER_COOLDOWN_MINUTES`: blocks resubmitting the same setup inside the cooldown window.
- `ANALYSIS_INTERVAL_SECONDS`: `0` runs once; any positive number keeps the bot running in a loop.

## Notes
- `EXECUTE_ORDERS=false` keeps the bot in analysis-only mode.
- `USE_TEST_ORDERS=true` appends `--test` to CLI bracket submission.
- Quantity is capped by `MIN_QUANTITY` and `MAX_QUANTITY`.
- Bot logs are written daily under the local `logs` folder and duplicate-protection state is stored under `state`.
- Trade journaling appends rows into monthly files such as `Trades_Mar2026.csv`.
