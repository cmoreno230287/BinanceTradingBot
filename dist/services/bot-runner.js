"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotRunner = void 0;
class BotRunner {
    tradingBotService;
    analysisIntervalSeconds;
    logger;
    constructor(tradingBotService, analysisIntervalSeconds, logger) {
        this.tradingBotService = tradingBotService;
        this.analysisIntervalSeconds = analysisIntervalSeconds;
        this.logger = logger;
    }
    async run() {
        let firstSubmittedTradeSetupId = null;
        if (this.analysisIntervalSeconds <= 0) {
            const summary = await this.tradingBotService.runOnce();
            clearConsole();
            console.log(formatConsoleSummary(summary));
            return;
        }
        for (;;) {
            const startedAt = new Date().toISOString();
            try {
                const summary = await this.tradingBotService.runOnce();
                if (!firstSubmittedTradeSetupId && typeof summary.submittedTradeSetupId === 'string') {
                    firstSubmittedTradeSetupId = summary.submittedTradeSetupId;
                }
                this.logger?.info('Trading cycle completed.', summary);
                clearConsole();
                console.log(formatConsoleSummary({ startedAt, ...summary }));
                if (shouldStopAfterFirstTradeWinner(summary, firstSubmittedTradeSetupId)) {
                    this.logger?.info('Bot runner stopped because first submitted trade closed as winner.', {
                        firstSubmittedTradeSetupId
                    });
                    break;
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.stack ?? error.message : String(error);
                this.logger?.error('Trading cycle failed.', { error: message });
                clearConsole();
                console.error(JSON.stringify({ startedAt, error: message }, null, 2));
            }
            await delay(this.analysisIntervalSeconds * 1000);
        }
    }
}
exports.BotRunner = BotRunner;
function clearConsole() {
    process.stdout.write('\x1Bc');
}
function formatConsoleSummary(summary) {
    const analysis = isRecord(summary.analysis) ? summary.analysis : {};
    const reasons = Array.isArray(analysis.reasons) ? analysis.reasons.filter((item) => typeof item === 'string') : [];
    const order = isRecord(summary.order) ? summary.order : {};
    const lines = [
        `Active Trade = ${summary.activeTrade === true ? 'true' : 'false'}`,
        `Active Trades Count = ${toNumber(summary.activeTradesCount)}`,
        `Closed Trades Count = ${toNumber(summary.closedTradesCount)}`
    ];
    if (typeof summary.startedAt === 'string') {
        lines.push(`Cycle Started At = ${summary.startedAt}`);
    }
    if (typeof analysis.strategyName === 'string') {
        lines.push(`Strategy = ${analysis.strategyName}`);
    }
    if (typeof analysis.session === 'string') {
        lines.push(`Session = ${analysis.session}`);
    }
    if (typeof order.reason === 'string') {
        lines.push(`Status = ${order.reason}`);
    }
    else if (order.executed === true) {
        lines.push('Status = Order submitted');
    }
    if (reasons.length > 0) {
        lines.push(`Reason = ${reasons[0]}`);
    }
    return lines.join('\n');
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
function toNumber(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
function delay(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}
function shouldStopAfterFirstTradeWinner(summary, firstSetupId) {
    if (!firstSetupId) {
        return false;
    }
    const closedTrades = Array.isArray(summary.closedTrades) ? summary.closedTrades : [];
    return closedTrades.some((trade) => isRecord(trade) &&
        trade.setupId === firstSetupId &&
        trade.outcomeStatus === 'TP');
}
//# sourceMappingURL=bot-runner.js.map