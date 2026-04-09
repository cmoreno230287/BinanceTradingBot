# BinanceTradingBot Technical Wiki

## 1. Purpose
This wiki is the developer reference for `C:\Projects\BinanceTradingBot`.

It covers:
- project structure and runtime flow
- architecture responsibilities
- strategy extension points
- how to add features safely
- operational files and debugging notes

## 2. Project Structure
- `src/index.ts`: process entrypoint, dependency wiring, runtime mode override (`--real` / `--test`)
- `src/config`: `.env` loading and app configuration
- `src/core`: shared domain contracts (`types.ts`)
- `src/infra/binance`: Binance market data and CLI order executor adapters
- `src/infra/fs`: persistence/logging adapters (`state`, `reports`, journal updates)
- `src/services`: orchestration and business rules
- `src/strategies`: strategy implementation classes
- `strategies/*.json`: strategy parameter definitions

## 3. Runtime Flow
Main flow is implemented in `TradingBotService.runOnce()`:

1. Load active strategy from `STRATEGY_ID`.
2. Fetch context/execution/entry candles in parallel.
3. Reconcile open trades to TP/SL outcomes.
4. Analyze setup via `SmcLiquiditySweepStrategy`.
5. If invalid setup, return summary with reasons.
6. If execution disabled, return summary without order.
7. Enforce max active trades (`MAX_ORDERS_ACTIVE`).
8. Enforce guard rules (daily limit and duplicate cooldown).
9. Calculate quantity from account risk and stop distance.
10. Submit bracket order through `BinanceIntegration.Cli.exe`.
11. Append journal row and persist open trade record.
12. Return cycle summary to `BotRunner`.

`BotRunner` repeats this cycle when `ANALYSIS_INTERVAL_SECONDS > 0`.

## 4. Execution Modes
You can force mode at startup:
- `node dist/index.js --real`
- `node dist/index.js --test`

When mode flag is passed, it overrides `.env` execution mode for that process:
- `--real` => `EXECUTE_ORDERS=true`, `USE_TEST_ORDERS=false`
- `--test` => `EXECUTE_ORDERS=true`, `USE_TEST_ORDERS=true`

If no mode flag is passed, `.env` values are used.

## 5. Core Risk and Guard Rules
- Position sizing uses `ACCOUNT_BALANCE_USD * RISK_PERCENT` and stop distance.
- Quantity is clamped by `MIN_QUANTITY` and `MAX_QUANTITY`.
- `MAX_TRADES_PER_DAY` limits daily submissions.
- `MAX_ORDERS_ACTIVE` limits simultaneous open trades.
- `DUPLICATE_ORDER_COOLDOWN_MINUTES` blocks repeated setup fingerprints.

## 6. First Trade Winner Stop Condition
`BotRunner` tracks the first submitted trade setup id in the current process.
If that specific trade later closes as `TP`, the runner exits the loop and stops the bot process.

This is process-scoped behavior and restarts reset the "first submitted trade" tracking.

## 7. Strategy Model
Strategy parameters are loaded from `strategies/*.json` and mapped to `StrategyDefinition`.

Current implementation uses `SmcLiquiditySweepStrategy`:
- session filter
- HTF context
- liquidity sweep + reclaim checks
- structure confirmation
- entry zone and risk validation
- target selection and R:R checks

### Add a New Strategy JSON
1. Add a new file in `strategies/`.
2. Match `StrategyDefinition` fields.
3. Set `STRATEGY_ID` in `.env`.

### Add a New Strategy Class
1. Create class in `src/strategies`.
2. Return valid `AnalysisResult`.
3. Route strategy selection in `TradingBotService` (currently hardwired to `SmcLiquiditySweepStrategy`).

## 8. Runtime Files
- `logs\YYYYMMDD.log`: cycle logs and errors
- `state\bot-state.json`: recent order fingerprint memory
- `state\open-trades.json`: currently open tracked trades
- `reports\trade-performance-report.csv`: lifecycle report (OPEN/TP/SL/CANCELED)
- `TRADE_JOURNAL_DIR\Trades_*.csv`: trade journal rows

## 9. Backtesting
Supported command:
- `npm run backtest -- --months 6`

`backtest-ab` is intentionally not supported.

## 10. Add Feature Checklist
1. Update domain contracts in `src/core/types.ts` if needed.
2. Add config keys in `src/config/app-config.ts` and `.env.example`.
3. Implement logic in the relevant service/adapter layer.
4. Keep logs explicit for decision transparency.
5. Build and run at least one cycle in test mode.
6. Update `README.md` and this wiki when behavior changes.
