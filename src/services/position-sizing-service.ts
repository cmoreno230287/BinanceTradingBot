import { AppConfig } from '../config/app-config';
import { PositionSizingResult, TradeSetup } from '../core/types';

export class PositionSizingService {
  public calculateQuantity(setup: TradeSetup, config: AppConfig, strategyDefaultQuantity: number): PositionSizingResult {
    const stopDistance = Math.abs(setup.entryPrice - setup.stopLossPrice);
    if (stopDistance <= 0) {
      return {
        quantity: strategyDefaultQuantity,
        riskAmountUsd: 0,
        stopDistance,
        reason: 'Fallback quantity used because stop distance was invalid.'
      };
    }

    const riskAmountUsd = config.accountBalanceUsd * (config.riskPercent / 100);
    const rawQuantity = riskAmountUsd / stopDistance;
    const normalizedQuantity = clamp(roundDown(rawQuantity, 6), config.minQuantity, config.maxQuantity);

    if (normalizedQuantity <= 0) {
      return {
        quantity: strategyDefaultQuantity,
        riskAmountUsd,
        stopDistance,
        reason: 'Fallback quantity used because calculated quantity was not positive.'
      };
    }

    return {
      quantity: normalizedQuantity,
      riskAmountUsd,
      stopDistance,
      reason: `Quantity sized from ${config.riskPercent}% risk on ${config.accountBalanceUsd.toFixed(2)} USD account balance.`
    };
  }
}

function roundDown(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.floor(value * factor) / factor;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
