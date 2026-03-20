export type TradeDirection = 'BUY' | 'SELL';
export type SessionName = 'ASIA' | 'LONDON' | 'NEW_YORK' | 'OFF_HOURS';
export type StructureSignal = 'CHOCH' | 'BOS';
export type EntryZoneType = 'FVG' | 'ORDER_BLOCK';
export type MarketBias = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface Candle {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface StrategyDefinition {
  id: string;
  name: string;
  symbol: string;
  contextInterval: string;
  executionInterval: string;
  entryInterval: string;
  candlesLimit: number;
  sweepLookback: number;
  structureLookback: number;
  minimumRiskReward: number;
  maxStopLossPercent: number;
  maxEntryDistancePercent: number;
  minimumDisplacementPercent: number;
  liquidityTargetLookback: number;
  defaultQuantity: number;
  sessions: SessionName[];
}

export interface TradeSetup {
  symbol: string;
  direction: TradeDirection;
  marketBias: MarketBias;
  setupId: string;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  riskRewardRatio: number;
  context: string;
  sweptLiquidity: string;
  confirmationType: StructureSignal;
  entryZoneType: EntryZoneType;
  entryZoneDescription: string;
  invalidationReason?: string;
}

export interface AnalysisResult {
  strategyId: string;
  strategyName: string;
  symbol: string;
  session: SessionName;
  shouldPlaceOrder: boolean;
  reasons: string[];
  setup?: TradeSetup;
}

export interface PositionSizingResult {
  quantity: number;
  riskAmountUsd: number;
  stopDistance: number;
  reason: string;
}

export interface OrderExecutionResult {
  executed: boolean;
  command: string[];
  stdout: string;
  stderr: string;
}

export interface BotState {
  recentOrders: RecentOrderRecord[];
}

export interface RecentOrderRecord {
  setupId: string;
  setupFingerprint: string;
  bracketId: string;
  createdAtIso: string;
  symbol: string;
  direction: TradeDirection;
  entryPrice: number;
  stopLossPrice: number;
}

export type TradeExecutionMode = 'ANALYSIS' | 'TEST' | 'LIVE';
export type TradeOutcomeStatus = 'OPEN' | 'TP' | 'SL' | 'CANCELED';

export interface OpenTradeRecord {
  setupId: string;
  bracketId: string;
  strategyId: string;
  symbol: string;
  session: SessionName;
  direction: TradeDirection;
  entryPrice: number;
  stopLossPrice: number;
  takeProfitPrice: number;
  riskRewardRatio: number;
  executionMode: TradeExecutionMode;
  openedAtIso: string;
  closedAtIso?: string;
  outcomeStatus: TradeOutcomeStatus;
}

export interface TradeJournalRecord {
  date: string;
  time: string;
  session: SessionName;
  direction: TradeDirection;
  htfContext: string;
  sweptLiquidity: string;
  confirmationType: StructureSignal;
  entryZone: string;
  stopLoss: number;
  takeProfit: number;
  riskRewardRatio: number;
  result: string;
}
