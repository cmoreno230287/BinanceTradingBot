import fs from 'node:fs';
import path from 'node:path';
import { OpenTradeRecord, TradeOutcomeStatus } from '../../core/types';

const OPEN_TRADES_FILE_NAME = 'open-trades.json';
const PERFORMANCE_REPORT_FILE_NAME = 'trade-performance-report.csv';
const PERFORMANCE_REPORT_HEADER = [
  'SetupId',
  'BracketId',
  'StrategyId',
  'Symbol',
  'Session',
  'Direction',
  'EntryPrice',
  'StopLossPrice',
  'TakeProfitPrice',
  'RiskRewardRatio',
  'ExecutionMode',
  'OpenedAt',
  'ClosedAt',
  'OutcomeStatus'
].join(',');

export class TradePerformanceStore {
  public constructor(
    private readonly stateDirectoryPath: string,
    private readonly reportsDirectoryPath: string
  ) {}

  public getOpenTrades(): OpenTradeRecord[] {
    const filePath = this.getOpenTradesFilePath();
    if (!fs.existsSync(filePath)) {
      return [];
    }

    return JSON.parse(fs.readFileSync(filePath, 'utf8')) as OpenTradeRecord[];
  }

  public saveOpenTrades(records: OpenTradeRecord[]): void {
    fs.mkdirSync(this.stateDirectoryPath, { recursive: true });
    fs.writeFileSync(this.getOpenTradesFilePath(), JSON.stringify(records, null, 2), 'utf8');
  }

  public addOpenTrade(record: OpenTradeRecord): void {
    const records = this.getOpenTrades();
    records.push(record);
    this.saveOpenTrades(records);
    this.upsertPerformanceRow(record);
  }

  public closeTrade(setupId: string, closedAtIso: string, outcomeStatus: TradeOutcomeStatus): void {
    const records = this.getOpenTrades();
    const updatedRecords = records.filter((record) => {
      if (record.setupId !== setupId) {
        return true;
      }

      const closedRecord: OpenTradeRecord = {
        ...record,
        closedAtIso,
        outcomeStatus
      };
      this.upsertPerformanceRow(closedRecord);
      return false;
    });

    this.saveOpenTrades(updatedRecords);
  }

  private upsertPerformanceRow(record: OpenTradeRecord): void {
    fs.mkdirSync(this.reportsDirectoryPath, { recursive: true });
    const filePath = this.getPerformanceReportFilePath();
    const rows = fs.existsSync(filePath)
      ? fs.readFileSync(filePath, 'utf8').split(/\r?\n/).filter((line) => line.length > 0)
      : [PERFORMANCE_REPORT_HEADER];

    const dataRows = rows.slice(1).filter((row) => !row.startsWith(`${record.setupId},`));
    dataRows.push(this.toCsvRow(record));

    fs.writeFileSync(filePath, [PERFORMANCE_REPORT_HEADER, ...dataRows].join('\n') + '\n', 'utf8');
  }

  private toCsvRow(record: OpenTradeRecord): string {
    return [
      record.setupId,
      record.bracketId,
      record.strategyId,
      record.symbol,
      record.session,
      record.direction,
      record.entryPrice.toFixed(2),
      record.stopLossPrice.toFixed(2),
      record.takeProfitPrice.toFixed(2),
      record.riskRewardRatio.toFixed(2),
      record.executionMode,
      record.openedAtIso,
      record.closedAtIso ?? '',
      record.outcomeStatus
    ].join(',');
  }

  private getOpenTradesFilePath(): string {
    return path.join(this.stateDirectoryPath, OPEN_TRADES_FILE_NAME);
  }

  private getPerformanceReportFilePath(): string {
    return path.join(this.reportsDirectoryPath, PERFORMANCE_REPORT_FILE_NAME);
  }
}
