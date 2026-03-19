import fs from 'node:fs';
import path from 'node:path';
import { BotState, RecentOrderRecord } from '../../core/types';

const STATE_FILE_NAME = 'bot-state.json';

export class BotStateStore {
  public constructor(private readonly stateDirectoryPath: string) {}

  public hasRecentOrder(setupId: string, cooldownMinutes: number, now: Date): boolean {
    const state = this.readState();
    const cutoff = now.getTime() - cooldownMinutes * 60_000;

    state.recentOrders = state.recentOrders.filter((record) => new Date(record.createdAtIso).getTime() >= cutoff);
    this.writeState(state);

    return state.recentOrders.some((record) => record.setupId === setupId);
  }

  public addRecentOrder(record: RecentOrderRecord): void {
    const state = this.readState();
    state.recentOrders.push(record);
    this.writeState(state);
  }

  private readState(): BotState {
    const filePath = this.getFilePath();
    if (!fs.existsSync(filePath)) {
      return { recentOrders: [] };
    }

    const payload = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(payload) as BotState;
  }

  private writeState(state: BotState): void {
    fs.mkdirSync(this.stateDirectoryPath, { recursive: true });
    fs.writeFileSync(this.getFilePath(), JSON.stringify(state, null, 2), 'utf8');
  }

  private getFilePath(): string {
    return path.join(this.stateDirectoryPath, STATE_FILE_NAME);
  }
}
