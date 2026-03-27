import fs from 'node:fs';
import path from 'node:path';
import { OpenTradeRecord, TradeJournalRecord } from '../../core/types';

const HEADER = 'Fecha,Hora,Sesion,Direccion,Contexto HTF,Nivel de liquidez barrido,Tipo de confirmacion,Zona de entrada,Stop Loss,Take Profit,R:R,Resultado';
const MAX_ROWS_PER_FILE = 3000;
const JOURNAL_FILE_PREFIX = 'Trades';
const JOURNAL_FILE_PATTERN = /^Trades_(\d{4})\.csv$/i;

export class TradeJournal {
  public constructor(private readonly outputDirectoryPath: string) {}

  public append(record: TradeJournalRecord, _date: Date): void {
    fs.mkdirSync(this.outputDirectoryPath, { recursive: true });

    const filePath = this.resolveWritableJournalFilePath();
    const row = [
      record.date,
      record.time,
      record.session,
      record.direction,
      csv(record.htfContext),
      csv(record.sweptLiquidity),
      record.confirmationType,
      csv(record.entryZone),
      record.stopLoss.toFixed(2),
      record.takeProfit.toFixed(2),
      record.riskRewardRatio.toFixed(2),
      csv(record.result)
    ].join(',');

    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, `${HEADER}\n${row}\n`, 'utf8');
      return;
    }

    fs.appendFileSync(filePath, `${row}\n`, 'utf8');
  }

  public countEntriesForDate(date: Date): number {
    const targetDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(date);
    let count = 0;

    for (const filePath of this.getJournalFilePaths()) {
      const lines = fs.readFileSync(filePath, 'utf8')
        .split(/\r?\n/)
        .slice(1)
        .filter((line) => line.trim().length > 0);

      count += lines.filter((line) => line.startsWith(`${targetDate},`)).length;
    }

    return count;
  }

  public updateResultForTrade(record: OpenTradeRecord): void {
    const filePaths = this.getJournalFilePaths().reverse();
    for (const filePath of filePaths) {
      const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
      let targetIndex = -1;

      for (let index = lines.length - 1; index >= 1; index -= 1) {
        const line = lines[index];
        if (!line.trim()) {
          continue;
        }

        const columns = parseCsvLine(line);
        if (columns.length < 12) {
          continue;
        }

        const direction = columns[3];
        const stopLoss = columns[8];
        const takeProfit = columns[9];
        const result = columns[11];

        if (
          direction === record.direction &&
          stopLoss === record.stopLossPrice.toFixed(2) &&
          takeProfit === record.takeProfitPrice.toFixed(2) &&
          (result === 'TestValidated' || result === 'Submitted')
        ) {
          targetIndex = index;
          columns[11] = record.outcomeStatus;
          lines[index] = toCsvLine(columns);
          break;
        }
      }

      if (targetIndex >= 0) {
        fs.writeFileSync(filePath, lines.join('\n'), 'utf8');
        return;
      }
    }
  }

  private resolveWritableJournalFilePath(): string {
    const files = this.getJournalFilePaths();
    if (files.length === 0) {
      return path.join(this.outputDirectoryPath, `${JOURNAL_FILE_PREFIX}_0001.csv`);
    }

    const latestPath = files[files.length - 1];
    const rowCount = this.countDataRows(latestPath);
    if (rowCount < MAX_ROWS_PER_FILE) {
      return latestPath;
    }

    const latestName = path.basename(latestPath);
    const match = latestName.match(JOURNAL_FILE_PATTERN);
    const currentIndex = match ? Number(match[1]) : files.length;
    const nextIndex = currentIndex + 1;
    const nextName = `${JOURNAL_FILE_PREFIX}_${String(nextIndex).padStart(4, '0')}.csv`;
    return path.join(this.outputDirectoryPath, nextName);
  }

  private getJournalFilePaths(): string[] {
    if (!fs.existsSync(this.outputDirectoryPath)) {
      return [];
    }

    const csvFiles = fs.readdirSync(this.outputDirectoryPath)
      .filter((fileName) => fileName.toLowerCase().endsWith('.csv'))
      .filter((fileName) => fileName.startsWith(`${JOURNAL_FILE_PREFIX}_`))
      .map((fileName) => ({
        fileName,
        fullPath: path.join(this.outputDirectoryPath, fileName),
        index: this.extractFileIndex(fileName)
      }))
      .sort((a, b) => a.index - b.index)
      .map((item) => item.fullPath);

    if (csvFiles.length > 0) {
      return csvFiles;
    }

    // Backward compatibility for legacy monthly naming.
    return fs.readdirSync(this.outputDirectoryPath)
      .filter((fileName) => fileName.toLowerCase().endsWith('.csv'))
      .filter((fileName) => fileName.startsWith(`${JOURNAL_FILE_PREFIX}_`))
      .sort((a, b) => a.localeCompare(b))
      .map((fileName) => path.join(this.outputDirectoryPath, fileName));
  }

  private extractFileIndex(fileName: string): number {
    const match = fileName.match(JOURNAL_FILE_PATTERN);
    if (match) {
      return Number(match[1]);
    }

    return Number.MAX_SAFE_INTEGER;
  }

  private countDataRows(filePath: string): number {
    if (!fs.existsSync(filePath)) {
      return 0;
    }

    return fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .slice(1)
      .filter((line) => line.trim().length > 0).length;
  }
}

function csv(value: string): string {
  return `"${value.replaceAll('"', '""')}"`;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (character === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += character;
  }

  values.push(current);
  return values;
}

function toCsvLine(columns: string[]): string {
  return columns.map((value, index) => {
    if ([4, 5, 7, 11].includes(index)) {
      return csv(value);
    }

    return value;
  }).join(',');
}
