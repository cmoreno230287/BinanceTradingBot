"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BinanceCliOrderExecutor = void 0;
const node_child_process_1 = require("node:child_process");
const node_util_1 = require("node:util");
const execFileAsync = (0, node_util_1.promisify)(node_child_process_1.execFile);
class BinanceCliOrderExecutor {
    executablePath;
    constructor(executablePath) {
        this.executablePath = executablePath;
    }
    async placeBracketOrder(options) {
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
    buildCommand(setup, bracketId, quantity, useTestOrders) {
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
exports.BinanceCliOrderExecutor = BinanceCliOrderExecutor;
//# sourceMappingURL=binance-cli-order-executor.js.map