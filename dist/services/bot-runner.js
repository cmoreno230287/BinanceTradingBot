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
        if (this.analysisIntervalSeconds <= 0) {
            const summary = await this.tradingBotService.runOnce();
            console.log(JSON.stringify(summary, null, 2));
            return;
        }
        for (;;) {
            const startedAt = new Date().toISOString();
            try {
                const summary = await this.tradingBotService.runOnce();
                this.logger?.info('Trading cycle completed.', summary);
                console.log(JSON.stringify({ startedAt, ...summary }, null, 2));
            }
            catch (error) {
                const message = error instanceof Error ? error.stack ?? error.message : String(error);
                this.logger?.error('Trading cycle failed.', { error: message });
                console.error(JSON.stringify({ startedAt, error: message }, null, 2));
            }
            await delay(this.analysisIntervalSeconds * 1000);
        }
    }
}
exports.BotRunner = BotRunner;
function delay(milliseconds) {
    return new Promise((resolve) => {
        setTimeout(resolve, milliseconds);
    });
}
//# sourceMappingURL=bot-runner.js.map