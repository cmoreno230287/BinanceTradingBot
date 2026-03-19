import { AnalysisResult, Candle, MarketBias, SessionName, StrategyDefinition, TradeDirection, TradeSetup } from '../core/types';

interface AnalysisInput {
  strategy: StrategyDefinition;
  symbol: string;
  contextCandles: Candle[];
  executionCandles: Candle[];
  entryCandles: Candle[];
}

export class SmcLiquiditySweepStrategy {
  public analyze(input: AnalysisInput): AnalysisResult {
    const session = resolveSession(new Date());
    const reasons: string[] = [];

    if (!input.strategy.sessions.includes(session)) {
      reasons.push(`Current session ${session} is outside the strategy whitelist.`);
      return this.noTrade(input, session, reasons);
    }

    const biasState = resolveBias(input.contextCandles, input.strategy.structureLookback);
    if (biasState.bias === 'NEUTRAL') {
      reasons.push(`Higher-timeframe context is neutral. ${biasState.reason}`);
      return this.noTrade(input, session, reasons);
    }

    const direction: TradeDirection = biasState.bias === 'BULLISH' ? 'BUY' : 'SELL';
    const sweep = findLiquiditySweep(input.executionCandles, input.strategy.sweepLookback, direction);
    if (!sweep) {
      reasons.push('No clear liquidity sweep was detected on the execution timeframe.');
      return this.noTrade(input, session, reasons);
    }

    const confirmation = findStructureConfirmation(
      input.entryCandles,
      direction,
      sweep.candle.closeTime,
      input.strategy.structureLookback,
      input.strategy.minimumDisplacementPercent
    );
    if (!confirmation) {
      reasons.push('No CHOCH/BOS confirmation with displacement was detected after the liquidity sweep.');
      return this.noTrade(input, session, reasons);
    }

    const fairValueGap = findFairValueGap(input.entryCandles, direction, confirmation.index);
    if (!fairValueGap) {
      reasons.push('No clean fair value gap was found near the impulse origin.');
      return this.noTrade(input, session, reasons);
    }

    const entryPrice = fairValueGap.midPrice;
    const stopLossPrice = sweep.extremePrice;
    const risk = Math.abs(entryPrice - stopLossPrice);
    if (risk <= 0) {
      reasons.push('Calculated risk is invalid.');
      return this.noTrade(input, session, reasons);
    }

    const stopLossPercent = (risk / entryPrice) * 100;
    if (stopLossPercent > input.strategy.maxStopLossPercent) {
      reasons.push(`Stop loss percent ${stopLossPercent.toFixed(2)} exceeded strategy limit.`);
      return this.noTrade(input, session, reasons);
    }

    const lastPrice = input.entryCandles[input.entryCandles.length - 1]?.close ?? entryPrice;
    const entryDistancePercent = Math.abs(lastPrice - entryPrice) / entryPrice * 100;
    if (entryDistancePercent > input.strategy.maxEntryDistancePercent) {
      reasons.push(`Entry retracement distance ${entryDistancePercent.toFixed(2)}% is too wide.`);
      return this.noTrade(input, session, reasons);
    }

    const liquidityTarget = findLiquidityTarget(
      input.executionCandles,
      direction,
      input.strategy.liquidityTargetLookback,
      entryPrice
    );
    if (!liquidityTarget) {
      reasons.push('No clean external liquidity target was found.');
      return this.noTrade(input, session, reasons);
    }

    const minimumTargetPrice = direction === 'BUY'
      ? entryPrice + risk * input.strategy.minimumRiskReward
      : entryPrice - risk * input.strategy.minimumRiskReward;
    const takeProfitPrice = direction === 'BUY'
      ? Math.max(minimumTargetPrice, liquidityTarget.price)
      : Math.min(minimumTargetPrice, liquidityTarget.price);
    const realizedRiskReward = Math.abs(takeProfitPrice - entryPrice) / risk;

    if (realizedRiskReward < input.strategy.minimumRiskReward) {
      reasons.push(`Available liquidity target only offers ${realizedRiskReward.toFixed(2)} R.`);
      return this.noTrade(input, session, reasons);
    }

    const setup: TradeSetup = {
      symbol: input.symbol,
      direction,
      marketBias: biasState.bias,
      setupId: buildSetupId(input.symbol, direction, entryPrice, stopLossPrice, takeProfitPrice),
      entryPrice,
      stopLossPrice,
      takeProfitPrice,
      riskRewardRatio: realizedRiskReward,
      context: buildContextSummary(biasState.bias, biasState.reason, input.contextCandles),
      sweptLiquidity: sweep.description,
      confirmationType: confirmation.type,
      entryZoneType: 'FVG',
      entryZoneDescription: fairValueGap.description
    };

    return {
      strategyId: input.strategy.id,
      strategyName: input.strategy.name,
      symbol: input.symbol,
      session,
      shouldPlaceOrder: true,
      reasons: [
        `Bias: ${biasState.bias}`,
        `Context: ${biasState.reason}`,
        `Sweep detected: ${sweep.description}`,
        `Confirmation: ${confirmation.type}`,
        `Entry zone: ${fairValueGap.description}`,
        `Target: ${liquidityTarget.description}`
      ],
      setup
    };
  }

  private noTrade(input: AnalysisInput, session: SessionName, reasons: string[]): AnalysisResult {
    return {
      strategyId: input.strategy.id,
      strategyName: input.strategy.name,
      symbol: input.symbol,
      session,
      shouldPlaceOrder: false,
      reasons
    };
  }
}

function resolveSession(date: Date): SessionName {
  const formatter = new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    hour12: false,
    timeZone: 'America/Bogota'
  });

  const hour = Number(formatter.format(date));
  if (hour >= 19 || hour < 2) {
    return 'ASIA';
  }

  if (hour >= 2 && hour < 7) {
    return 'LONDON';
  }

  if (hour >= 7 && hour < 12) {
    return 'NEW_YORK';
  }

  return 'OFF_HOURS';
}

function resolveBias(candles: Candle[], structureLookback: number): { bias: MarketBias; reason: string } {
  const recentCandles = candles.slice(-(structureLookback + 6));
  if (recentCandles.length < structureLookback + 2) {
    return { bias: 'NEUTRAL', reason: 'Not enough higher-timeframe candles.' };
  }

  const lastCandle = recentCandles[recentCandles.length - 1];
  const previousCandle = recentCandles[recentCandles.length - 2];
  const referenceRange = recentCandles.slice(-structureLookback);
  const rangeHigh = Math.max(...referenceRange.map((candle) => candle.high));
  const rangeLow = Math.min(...referenceRange.map((candle) => candle.low));
  const rangeMidpoint = (rangeHigh + rangeLow) / 2;

  const bullishStructure = lastCandle.high > previousCandle.high && lastCandle.low > previousCandle.low;
  const bearishStructure = lastCandle.high < previousCandle.high && lastCandle.low < previousCandle.low;
  const inDiscount = lastCandle.close <= rangeMidpoint;
  const inPremium = lastCandle.close >= rangeMidpoint;

  if (bullishStructure && inDiscount) {
    return { bias: 'BULLISH', reason: `HH/HL structure with price in discount below ${rangeMidpoint.toFixed(2)}.` };
  }

  if (bearishStructure && inPremium) {
    return { bias: 'BEARISH', reason: `LH/LL structure with price in premium above ${rangeMidpoint.toFixed(2)}.` };
  }

  return { bias: 'NEUTRAL', reason: 'No aligned HTF structure and premium/discount context.' };
}

function findLiquiditySweep(candles: Candle[], lookback: number, direction: TradeDirection): {
  candle: Candle;
  extremePrice: number;
  description: string;
} | null {
  for (let index = candles.length - 2; index >= lookback; index -= 1) {
    const candidate = candles[index];
    const history = candles.slice(index - lookback, index);

    if (direction === 'BUY') {
      const priorLow = Math.min(...history.map((candle) => candle.low));
      if (candidate.low < priorLow && candidate.close > priorLow) {
        return {
          candle: candidate,
          extremePrice: candidate.low,
          description: `Sell-side sweep below ${priorLow.toFixed(2)}`
        };
      }

      continue;
    }

    const priorHigh = Math.max(...history.map((candle) => candle.high));
    if (candidate.high > priorHigh && candidate.close < priorHigh) {
      return {
        candle: candidate,
        extremePrice: candidate.high,
        description: `Buy-side sweep above ${priorHigh.toFixed(2)}`
      };
    }
  }

  return null;
}

function findStructureConfirmation(
  candles: Candle[],
  direction: TradeDirection,
  sweepCloseTime: number,
  structureLookback: number,
  minimumDisplacementPercent: number
): {
  type: 'CHOCH' | 'BOS';
  index: number;
} | null {
  const sweepIndex = candles.findIndex((candle) => candle.closeTime >= sweepCloseTime);
  const startIndex = Math.max(sweepIndex, 1);

  for (let index = startIndex; index < candles.length; index += 1) {
    const current = candles[index];
    const windowStart = Math.max(index - structureLookback, 0);
    const window = candles.slice(windowStart, index);
    if (window.length === 0) {
      continue;
    }

    const bodyPercent = Math.abs(current.close - current.open) / current.open * 100;
    if (bodyPercent < minimumDisplacementPercent) {
      continue;
    }

    if (direction === 'BUY' && current.close > Math.max(...window.map((candle) => candle.high))) {
      return { type: index - startIndex <= 2 ? 'CHOCH' : 'BOS', index };
    }

    if (direction === 'SELL' && current.close < Math.min(...window.map((candle) => candle.low))) {
      return { type: index - startIndex <= 2 ? 'CHOCH' : 'BOS', index };
    }
  }

  return null;
}

function findFairValueGap(candles: Candle[], direction: TradeDirection, confirmationIndex: number): {
  midPrice: number;
  description: string;
} | null {
  for (let index = confirmationIndex; index >= 2; index -= 1) {
    const first = candles[index - 2];
    const third = candles[index];

    if (direction === 'BUY' && first.high < third.low) {
      const low = first.high;
      const high = third.low;
      return {
        midPrice: (low + high) / 2,
        description: `Bullish FVG between ${low.toFixed(2)} and ${high.toFixed(2)}`
      };
    }

    if (direction === 'SELL' && first.low > third.high) {
      const low = third.high;
      const high = first.low;
      return {
        midPrice: (low + high) / 2,
        description: `Bearish FVG between ${low.toFixed(2)} and ${high.toFixed(2)}`
      };
    }
  }

  return null;
}

function findLiquidityTarget(
  candles: Candle[],
  direction: TradeDirection,
  lookback: number,
  entryPrice: number
): { price: number; description: string } | null {
  const referenceCandles = candles.slice(-lookback);
  if (referenceCandles.length === 0) {
    return null;
  }

  if (direction === 'BUY') {
    const target = Math.max(...referenceCandles.map((candle) => candle.high));
    if (target <= entryPrice) {
      return null;
    }

    return {
      price: target,
      description: `External buy-side liquidity near ${target.toFixed(2)}`
    };
  }

  const target = Math.min(...referenceCandles.map((candle) => candle.low));
  if (target >= entryPrice) {
    return null;
  }

  return {
    price: target,
    description: `External sell-side liquidity near ${target.toFixed(2)}`
  };
}

function buildContextSummary(bias: MarketBias, biasReason: string, candles: Candle[]): string {
  const recentCandles = candles.slice(-10);
  const high = Math.max(...recentCandles.map((candle) => candle.high));
  const low = Math.min(...recentCandles.map((candle) => candle.low));
  return `${bias} HTF context inside ${low.toFixed(2)}-${high.toFixed(2)} range. ${biasReason}`;
}

function buildSetupId(
  symbol: string,
  direction: TradeDirection,
  entryPrice: number,
  stopLossPrice: number,
  takeProfitPrice: number
): string {
  return [
    symbol,
    direction,
    entryPrice.toFixed(2),
    stopLossPrice.toFixed(2),
    takeProfitPrice.toFixed(2)
  ].join('|');
}
