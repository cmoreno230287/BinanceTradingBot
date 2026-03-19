import fs from 'node:fs';
import path from 'node:path';

export class BotLogger {
  public constructor(private readonly logsDirectoryPath: string) {}

  public info(message: string, details?: unknown): void {
    this.write('INFO', message, details);
  }

  public error(message: string, details?: unknown): void {
    this.write('ERROR', message, details);
  }

  private write(level: 'INFO' | 'ERROR', message: string, details?: unknown): void {
    fs.mkdirSync(this.logsDirectoryPath, { recursive: true });

    const now = new Date();
    const timestamp = new Intl.DateTimeFormat('sv-SE', {
      dateStyle: 'short',
      timeStyle: 'medium',
      timeZone: 'America/Bogota'
    }).format(now);

    const fileName = `${formatDateToken(now)}.log`;
    const detailBlock = details === undefined ? '' : ` ${safeStringify(details)}`;
    fs.appendFileSync(path.join(this.logsDirectoryPath, fileName), `[${timestamp}] [${level}] ${message}${detailBlock}\n`, 'utf8');
  }
}

function formatDateToken(date: Date): string {
  const formatter = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'America/Bogota'
  });

  return formatter.format(date).replaceAll('-', '');
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
