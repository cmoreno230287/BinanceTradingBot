import fs from 'node:fs';
import path from 'node:path';
import { OpenTradeRecord, TradeJournalRecord } from '../../core/types';

const HEADER = 'Fecha,Hora,Sesion,Direccion,Contexto HTF,Nivel de liquidez barrido,Tipo de confirmacion,Zona de entrada,Stop Loss,Take Profit,R:R,Resultado';

export class TradeJournal {
  public constructor(private readonly outputDirectoryPath: string) {}

  public append(record: TradeJournalRecord, date: Date): void {
    fs.mkdirSync(this.outputDirectoryPath, { recursive: true });

    const monthFileName = `Trades_${formatMonthFileToken(date)}.csv`;
    const filePath = path.join(this.outputDirectoryPath, monthFileName);
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
    const monthFileName = `Trades_${formatMonthFileToken(date)}.csv`;
    const filePath = path.join(this.outputDirectoryPath, monthFileName);
    if (!fs.existsSync(filePath)) {
      return 0;
    }

    const targetDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(date);
    const lines = fs.readFileSync(filePath, 'utf8')
      .split(/\r?\n/)
      .slice(1)
      .filter((line) => line.trim().length > 0);

    return lines.filter((line) => line.startsWith(`${targetDate},`)).length;
  }

  public updateResultForTrade(record: OpenTradeRecord): void {
    const openedAt = new Date(record.openedAtIso);
    const monthFileName = `Trades_${formatMonthFileToken(openedAt)}.csv`;
    const filePath = path.join(this.outputDirectoryPath, monthFileName);
    if (!fs.existsSync(filePath)) {
      return;
    }

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
    }
  }
}

function formatMonthFileToken(date: Date): string {
  const formatter = new Intl.DateTimeFormat('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'America/Bogota'
  });

  const parts = formatter.formatToParts(date);
  const month = parts.find((part) => part.type === 'month')?.value ?? 'Jan';
  const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
  return `${month}${year}`;
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
