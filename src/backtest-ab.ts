import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

interface CliArgs {
  strategyA: string;
  strategyB: string;
  months?: string;
  from?: string;
  to?: string;
  balance?: string;
  risk?: string;
  symbol?: string;
}

interface BacktestSummaryResults {
  totalSignals: number;
  closedTrades: number;
  winners: number;
  losers: number;
  winRatePercent: number;
  totalR: number;
  initialBalanceUsd: number;
  finalBalanceUsd: number;
  netPnlUsd: number;
  maxDrawdownPercent: number;
}

interface BacktestRunOutput {
  summary: {
    strategyId: string;
    symbol: string;
    range: {
      from: string;
      to: string;
      months: number;
    };
    results: BacktestSummaryResults;
  };
  reportPaths: {
    jsonPath: string;
    csvPath: string;
  };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const runA = runBacktest('A', args.strategyA, args);
  const runB = runBacktest('B', args.strategyB, args);

  const comparison = {
    strategyA: runA.summary.strategyId,
    strategyB: runB.summary.strategyId,
    symbol: runA.summary.symbol,
    range: runA.summary.range,
    metrics: {
      winRatePercent: buildMetric(runA.summary.results.winRatePercent, runB.summary.results.winRatePercent, false),
      totalR: buildMetric(runA.summary.results.totalR, runB.summary.results.totalR, false),
      netPnlUsd: buildMetric(runA.summary.results.netPnlUsd, runB.summary.results.netPnlUsd, false),
      maxDrawdownPercent: buildMetric(runA.summary.results.maxDrawdownPercent, runB.summary.results.maxDrawdownPercent, true),
      totalSignals: buildMetric(runA.summary.results.totalSignals, runB.summary.results.totalSignals, false)
    },
    outputs: {
      A: runA.reportPaths,
      B: runB.reportPaths
    }
  };

  const outputDirectory = path.join(path.dirname(runA.reportPaths.jsonPath), 'comparisons');
  fs.mkdirSync(outputDirectory, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const comparisonPath = path.join(outputDirectory, `ab_comparison_${stamp}.json`);
  fs.writeFileSync(comparisonPath, JSON.stringify(comparison, null, 2), 'utf8');

  console.log(JSON.stringify({ comparison, comparisonPath }, null, 2));
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    strategyA: 'strategy-1-btc-sweep',
    strategyB: 'strategy-1-btc-sweep-conservative'
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    const next = argv[index + 1];
    if (!next) {
      continue;
    }

    if (current === '--strategy-a') {
      args.strategyA = next;
      index += 1;
      continue;
    }

    if (current === '--strategy-b') {
      args.strategyB = next;
      index += 1;
      continue;
    }

    if (current === '--months') {
      args.months = next;
      index += 1;
      continue;
    }

    if (current === '--from') {
      args.from = next;
      index += 1;
      continue;
    }

    if (current === '--to') {
      args.to = next;
      index += 1;
      continue;
    }

    if (current === '--balance') {
      args.balance = next;
      index += 1;
      continue;
    }

    if (current === '--risk') {
      args.risk = next;
      index += 1;
      continue;
    }

    if (current === '--symbol') {
      args.symbol = next;
      index += 1;
    }
  }

  return args;
}

function runBacktest(label: 'A' | 'B', strategyId: string, args: CliArgs): BacktestRunOutput {
  const backtestScriptPath = path.join(__dirname, 'backtest.js');
  const cliArgs: string[] = [backtestScriptPath, '--strategy', strategyId];

  if (args.months) {
    cliArgs.push('--months', args.months);
  }
  if (args.from) {
    cliArgs.push('--from', args.from);
  }
  if (args.to) {
    cliArgs.push('--to', args.to);
  }
  if (args.balance) {
    cliArgs.push('--balance', args.balance);
  }
  if (args.risk) {
    cliArgs.push('--risk', args.risk);
  }
  if (args.symbol) {
    cliArgs.push('--symbol', args.symbol);
  }

  const result = spawnSync(process.execPath, cliArgs, {
    cwd: path.resolve(__dirname, '..'),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });

  if (result.status !== 0) {
    const message = result.stderr?.trim() || result.stdout?.trim() || `Backtest ${label} failed`;
    throw new Error(`Backtest ${label} (${strategyId}) failed: ${message}`);
  }

  return parseBacktestOutput(result.stdout);
}

function parseBacktestOutput(stdout: string): BacktestRunOutput {
  const jsonStart = stdout.indexOf('{');
  if (jsonStart < 0) {
    throw new Error(`Unable to parse backtest output. Raw: ${stdout}`);
  }

  const jsonText = stdout.slice(jsonStart).trim();
  return JSON.parse(jsonText) as BacktestRunOutput;
}

function buildMetric(a: number, b: number, lowerIsBetter: boolean): {
  A: number;
  B: number;
  deltaBMinusA: number;
  better: 'A' | 'B' | 'TIE';
} {
  const delta = b - a;

  if (delta === 0) {
    return { A: a, B: b, deltaBMinusA: 0, better: 'TIE' };
  }

  if (lowerIsBetter) {
    return { A: a, B: b, deltaBMinusA: delta, better: b < a ? 'B' : 'A' };
  }

  return { A: a, B: b, deltaBMinusA: delta, better: b > a ? 'B' : 'A' };
}

main();
