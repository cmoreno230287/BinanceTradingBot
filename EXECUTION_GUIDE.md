# Execution Guide

This guide explains how to run `BinanceTradingBot_V2` in analysis mode, test-order mode, and live-order mode.

## 1. Project Location

- Project path: `C:\Projects\BinanceTradingBot_V2`
- Binance CLI path expected by default:
  `C:\Projects\BinanceIntegration\BinanceIntegration.Cli\bin\Release\net8.0\BinanceIntegration.Cli.exe`

## 2. Prerequisites

Before running the bot, confirm:

- Node.js is installed.
- The Binance Integration CLI is already built.
- The file `.env` exists in the project root.

## 3. Important Files

- `.env`: active runtime configuration
- `strategies\*.json`: available strategy definitions
- `logs\`: bot execution logs
- `state\bot-state.json`: duplicate-order protection state
- `dist\`: compiled JavaScript output

## 4. Configure the Bot

Open `.env` and review these values:

```env
BOT_NAME=BinanceTradingBot_V2
STRATEGY_ID=strategy-1-btc-sweep
BINANCE_SYMBOL=BTCUSDT
BINANCE_BASE_URL=https://api.binance.com
BINANCE_CLI_PATH=C:\Projects\BinanceIntegration\BinanceIntegration.Cli\bin\Release\net8.0\BinanceIntegration.Cli.exe
TRADE_JOURNAL_DIR=C:\Codex\Agents\Expert_Trader\Resources\Trades
RISK_PERCENT=1
ACCOUNT_BALANCE_USD=1000
DEFAULT_QUANTITY=0.0001
MIN_QUANTITY=0.00001
MAX_QUANTITY=0.01
MAX_TRADES_PER_DAY=3
DUPLICATE_ORDER_COOLDOWN_MINUTES=90
EXECUTE_ORDERS=false
USE_TEST_ORDERS=true
ANALYSIS_INTERVAL_SECONDS=0
```

Key settings:

- `STRATEGY_ID`: selects which strategy file to use from `strategies\`
- `EXECUTE_ORDERS=false`: analysis only, no orders sent
- `EXECUTE_ORDERS=true`: enables order submission
- `USE_TEST_ORDERS=true`: uses Binance CLI `--test` mode
- `ANALYSIS_INTERVAL_SECONDS=0`: run once
- `ANALYSIS_INTERVAL_SECONDS=60`: run every 60 seconds

## 5. Install Dependencies

From PowerShell:

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
npm.cmd install
```

## 6. Build the Project

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
npm.cmd run build
```

This compiles the TypeScript files into `dist\`.

## 7. Run Modes

### Analysis Only

Recommended for validating the strategy without creating orders.

Use:

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
$env:EXECUTE_ORDERS='false'
$env:ANALYSIS_INTERVAL_SECONDS='0'
node .\dist\index.js
```

Expected result:

- The bot fetches Binance candles
- The selected strategy analyzes the market
- A JSON summary is printed
- No order is sent

### Repeated Analysis Loop

Runs the bot continuously with a fixed interval.

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
$env:EXECUTE_ORDERS='false'
$env:ANALYSIS_INTERVAL_SECONDS='60'
node .\dist\index.js
```

This runs one cycle every 60 seconds.

### Test Order Mode

This mode allows the bot to reach the order-execution path while still using Binance CLI test submission.

Set in `.env`:

```env
EXECUTE_ORDERS=true
USE_TEST_ORDERS=true
```

Then run:

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
npm.cmd run build
node .\dist\index.js
```

Notes:

- An order is attempted only if the strategy finds a valid setup.
- Guard rules still apply:
  - daily trade limit
  - duplicate setup cooldown

### Live Order Mode

Use this only when you have verified all settings.

Set in `.env`:

```env
EXECUTE_ORDERS=true
USE_TEST_ORDERS=false
```

Then run:

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
npm.cmd run build
node .\dist\index.js
```

Before running live:

- confirm `BINANCE_CLI_PATH`
- confirm strategy selection
- confirm `ACCOUNT_BALANCE_USD`
- confirm `RISK_PERCENT`
- confirm trade limits and cooldown values

## 8. Strategy Selection

Available strategy files are in:

`C:\Projects\BinanceTradingBot_V2\strategies`

To switch strategy, change only:

```env
STRATEGY_ID=strategy-1-btc-sweep-conservative
```

Then rebuild and run again.

## 9. Output and Monitoring

### Console Output

Each run prints a JSON result with:

- strategy info
- session
- reasons for trade / no trade
- position sizing
- order execution result when applicable

### Logs

Daily logs are written to:

`C:\Projects\BinanceTradingBot_V2\logs`

Example:

- `20260319.log`

### Duplicate Protection State

The bot stores recently submitted setups in:

`C:\Projects\BinanceTradingBot_V2\state\bot-state.json`

This prevents resubmitting the same setup within the configured cooldown.

### Trade Journal

Trade records are appended to:

`C:\Codex\Agents\Expert_Trader\Resources\Trades`

Example monthly file:

- `Trades_Mar2026.csv`

### Performance Report For Test Mode

Final simulated outcomes for test-mode trades are written to:

`C:\Projects\BinanceTradingBot_V2\reports\trade-performance-report.csv`

Open simulated trades are stored in:

`C:\Projects\BinanceTradingBot_V2\state\open-trades.json`

The bot reevaluates those open trades on each cycle using fresh entry-timeframe candles and closes them as:

- `TP`
- `SL`
- or keeps them `OPEN`

## 10. Recommended Execution Sequence

1. Review `.env`
2. Run `npm.cmd run build`
3. Run analysis-only mode first
4. Run test-order mode
5. Switch to live mode only after verification

## 11. Common Commands

Build:

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
npm.cmd run build
```

Single analysis run:

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
$env:EXECUTE_ORDERS='false'
$env:ANALYSIS_INTERVAL_SECONDS='0'
node .\dist\index.js
```

Continuous loop every 60 seconds:

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
$env:EXECUTE_ORDERS='false'
$env:ANALYSIS_INTERVAL_SECONDS='60'
node .\dist\index.js
```

## 12. Troubleshooting

If `dist\index.js` does not exist:

```powershell
npm.cmd run build
```

If the bot cannot execute Binance CLI:

- verify `BINANCE_CLI_PATH`
- verify the CLI executable exists
- verify the Binance Integration project was built successfully

If no orders are created:

- check whether the current session is outside the strategy session whitelist
- check console output reasons
- check `logs\`
- check duplicate cooldown and daily limit settings

If position size looks wrong:

- review `ACCOUNT_BALANCE_USD`
- review `RISK_PERCENT`
- review `MIN_QUANTITY` and `MAX_QUANTITY`

## 13. Safe First Run

For the safest first execution, use:

```env
EXECUTE_ORDERS=false
USE_TEST_ORDERS=true
ANALYSIS_INTERVAL_SECONDS=0
```

Then run:

```powershell
Set-Location 'C:\Projects\BinanceTradingBot_V2'
npm.cmd run build
node .\dist\index.js
```
