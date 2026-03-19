import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { OrderExecutionResult, TradeSetup } from '../../core/types';

const execFileAsync = promisify(execFile);

export class BinanceCliOrderExecutor {
  public constructor(private readonly executablePath: string) {}

  public async placeBracketOrder(options: {
    setup: TradeSetup;
    bracketId: string;
    quantity: number;
    useTestOrders: boolean;
  }): Promise<OrderExecutionResult> {
    const command = this.buildCommand(options.setup, options.bracketId, options.quantity, options.useTestOrders);
    const [executablePath, ...args] = command;

    const result = await execFileAsync(executablePath, args, {
      windowsHide: true,
      maxBuffer: 1024 * 1024
    });

    return {
      executed: true,
      command,
      stdout: result.stdout,
      stderr: result.stderr
    };
  }

  private buildCommand(setup: TradeSetup, bracketId: string, quantity: number, useTestOrders: boolean): string[] {
    const stopLossLimitPrice = setup.direction === 'BUY'
      ? setup.stopLossPrice * 0.9995
      : setup.stopLossPrice * 1.0005;

    const command = [
      this.executablePath,
      'bracket',
      '--symbol', setup.symbol,
      '--side', setup.direction,
      '--bracketId', bracketId,
      '--entryPrice', setup.entryPrice.toFixed(2),
      '--quantity', quantity.toFixed(6),
      '--takeProfitPrice', setup.takeProfitPrice.toFixed(2),
      '--stopLossTriggerPrice', setup.stopLossPrice.toFixed(2),
      '--stopLossLimitPrice', stopLossLimitPrice.toFixed(2)
    ];

    if (useTestOrders) {
      command.push('--test');
    }

    return command;
  }
}
