# BinanceTradingBot Technical Wiki

## 1. Purpose
This document is the technical onboarding guide for developers working on `BinanceTradingBot`.

It explains:
- code structure and runtime flow
- architecture boundaries and responsibilities
- strategy model and how to add new strategies
- how to add new features safely
- operational files, outputs, and troubleshooting notes

## 2. Tech Stack
- Runtime: Node.js 20+
- Language: TypeScript (`commonjs` output)
- Data source: Binance REST (`/api/v3/klines`)
- Order execution: external .NET CLI (`BinanceIntegration.Cli.exe`)
- Persistence: local filesystem (`state`, `reports`, `logs`, external trade journal directory)

## 3. High-Level Architecture
The project follows a layered flow:

1. `src/index.ts` wires dependencies and starts the bot.
2. `BotRunner` controls one-shot or looped execution (`ANALYSIS_INTERVAL_SECONDS`).
3. `TradingBotService` orchestrates one full cycle.
4. Infrastructure adapters handle Binance API, CLI execution, and file persistence.
5. Strategy logic (`SmcLiquiditySweepStrategy`) decides if a setup is tradable.

### Layers
- `src/config`: app/env configuration loading
- `src/core`: shared domain types and contracts
- `src/infra/binance`: external Binance integrations (market data + order placement)
- `src/infra/fs`: persistence/logging adapters
- `src/services`: orchestration and risk/guard/outcome logic
- `src/strategies`: strategy algorithm(s)
- `strategies/*.json`: strategy parameter definitions

## 4. Runtime Flow (One Cycle)
Implemented in `TradingBotService.runOnce()`:

1. Load active strategy by `STRATEGY_ID`.
2. Fetch candle sets in parallel:
- context timeframe
- execution timeframe
- entry timeframe
3. Reconcile open test trades against new candles (TP/SL updates).
4. Analyze market with `SmcLiquiditySweepStrategy`.
5. If no valid setup, return analysis-only summary.
6. If `EXECUTE_ORDERS=false`, skip execution and return summary.
7. Apply guard rules:
- max trades per day
- duplicate setup cooldown
8. Compute quantity using account-risk model.
9. Build bracket id and place order through Binance CLI.
10. Append trade journal CSV row.
11. If test mode, register open trade for later TP/SL reconciliation.
12. Persist recent order state and return cycle summary.

## 5. Key Domain Contracts
Located in `src/core/types.ts`.

Important models:
- `StrategyDefinition`: JSON contract for strategy parameter files
- `AnalysisResult`: strategy output (`shouldPlaceOrder`, `reasons`, optional `setup`)
- `TradeSetup`: executable setup with entry/SL/TP/context metadata
- `OpenTradeRecord`: tracked test/live trade state for outcome reporting

When adding new behavior, preserve these contracts first, then propagate changes to dependent services.

## 6. Configuration and Environment
`loadAppConfig()` (`src/config/app-config.ts`) reads `.env` and applies fallbacks.

### Critical variables
- `STRATEGY_ID`: active strategy JSON id
- `BINANCE_SYMBOL`: runtime symbol for analysis/execution
- `EXECUTE_ORDERS`: enable/disable order submission
- `USE_TEST_ORDERS`: adds `--test` flag in CLI orders
- `RISK_PERCENT`, `ACCOUNT_BALANCE_USD`: position sizing inputs
- `MAX_TRADES_PER_DAY`, `DUPLICATE_ORDER_COOLDOWN_MINUTES`: guard limits
- `ANALYSIS_INTERVAL_SECONDS`: `0` = run once, `>0` = continuous loop

### Important path note
Default `TRADE_JOURNAL_DIR` points to:
`C:\Codex\Agents\Expert_Trader\Resources\Trades`

In this workspace, requirements are under `C:\Codex\Codex_Agents\...`.
Confirm your actual journal path in `.env` to avoid writing to a non-existing legacy folder.

## 7. Strategy System
### Current implementation
The code currently instantiates `SmcLiquiditySweepStrategy` directly in `TradingBotService`.

Signal logic summary:
1. Session whitelist validation (Bogota timezone)
2. HTF bias detection (premium/discount + structure)
3. Liquidity sweep detection
4. CHOCH/BOS confirmation with displacement
5. FVG entry zone detection
6. Risk constraints validation
7. External liquidity TP selection
8. Final R:R validation

### Add or tune strategy parameters
1. Create a new JSON file in `strategies/`.
2. Keep the `StrategyDefinition` schema.
3. Use a unique `id`.
4. Set `STRATEGY_ID` in `.env` to activate it.

## 8. How To Add a New Strategy Class
If you want a different algorithm (not only parameter tuning):

1. Add class in `src/strategies`, e.g. `my-new-strategy.ts`.
2. Implement `analyze(input)` returning `AnalysisResult`.
3. In `TradingBotService`, replace direct instantiation with strategy selection logic, for example by `strategyDefinition.id`.
4. Keep `TradeSetup` fields complete when `shouldPlaceOrder=true`.
5. Ensure reasons are clear for no-trade outcomes.

Recommended refactor for scalability:
- introduce a `StrategyEngine` interface
- create a `StrategyFactory` that maps `strategy.id -> strategy class`

This avoids editing orchestration logic every time a strategy is added.

## 9. Risk and Execution Controls
### Position sizing
`PositionSizingService`:
- risk amount = `ACCOUNT_BALANCE_USD * (RISK_PERCENT/100)`
- quantity = `risk amount / stop distance`
- quantity rounded down (6 decimals), then clamped by min/max quantity
- fallback to strategy default quantity when invalid

### Order guard
`OrderGuardService` blocks execution when:
- trade count for today reaches `MAX_TRADES_PER_DAY`
- same setup fingerprint appears within cooldown window

### Bracket command
`BinanceCliOrderExecutor` builds:
- entry, TP, SL trigger, SL limit
- optional `--test`

## 10. Files Created at Runtime
- `logs/YYYYMMDD.log`: cycle logs and errors
- `state/bot-state.json`: recent order dedup memory
- `state/open-trades.json`: currently open tracked trades
- `reports/trade-performance-report.csv`: TP/SL lifecycle report
- `TRADE_JOURNAL_DIR/Trades_MonYYYY.csv`: execution journal (Spanish headers)

## 11. How To Add New Features Safely
Use this checklist for any feature:

1. Extend domain types in `src/core/types.ts` first.
2. Add/adjust config in `AppConfig` and `.env.example` if needed.
3. Implement infra adapter changes (API/FS/CLI) behind current service contracts.
4. Update orchestration in `TradingBotService` only after contracts compile.
5. Preserve no-trade behavior and guard checks.
6. Keep logs explicit for observability.
7. Build and run one cycle in analysis mode before enabling execution.

## 12. Build and Run
```bash
npm.cmd install
npm.cmd run build
npm.cmd run start
```

Common modes:
- dry run: `EXECUTE_ORDERS=false`
- test order submission: `EXECUTE_ORDERS=true` and `USE_TEST_ORDERS=true`
- continuous operation: set `ANALYSIS_INTERVAL_SECONDS` > 0

## 13. Recommended Next Improvements
- Add a strategy factory to remove hardcoded strategy class selection.
- Add unit tests for:
  - strategy signal generation
  - position sizing edge cases
  - trade outcome reconciliation (same-candle TP/SL ambiguity)
- Add JSON schema validation for strategy files before loading.
- Add stronger idempotency keying for journal updates (currently matched by direction/SL/TP/result).

## 14. Troubleshooting
- Strategy not found:
  - verify `STRATEGY_ID` matches `strategies/*.json` `id` exactly.
- No orders placed:
  - check `analysis.reasons` in console/log output.
  - verify `EXECUTE_ORDERS=true`.
  - verify guard limits are not blocking execution.
- Journal not updating:
  - confirm `TRADE_JOURNAL_DIR` path exists and is writable.
- CLI execution error:
  - verify `BINANCE_CLI_PATH` points to existing compiled `.exe`.
