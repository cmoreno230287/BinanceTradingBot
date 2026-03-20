"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OrderGuardService = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
class OrderGuardService {
    stateStore;
    tradeJournal;
    constructor(stateStore, tradeJournal) {
        this.stateStore = stateStore;
        this.tradeJournal = tradeJournal;
    }
    getBlockReason(setup, config, now) {
        const tradesToday = this.tradeJournal.countEntriesForDate(now);
        if (tradesToday >= config.maxTradesPerDay) {
            return `Daily trade limit reached (${tradesToday}/${config.maxTradesPerDay}).`;
        }
        const setupFingerprint = this.buildSetupFingerprint(setup);
        if (this.stateStore.hasRecentOrder(setup.setupId, setupFingerprint, config.duplicateOrderCooldownMinutes, now)) {
            return `Duplicate setup blocked during ${config.duplicateOrderCooldownMinutes} minute cooldown.`;
        }
        return null;
    }
    buildBracketId(setup) {
        const hash = node_crypto_1.default.createHash('sha256')
            .update(`${setup.setupId}|${setup.symbol}|${setup.direction}|${setup.entryPrice.toFixed(2)}`)
            .digest('hex');
        return `bot-${hash.slice(0, 16)}`;
    }
    markOrderSubmitted(setup, bracketId, now) {
        this.stateStore.addRecentOrder({
            setupId: setup.setupId,
            setupFingerprint: this.buildSetupFingerprint(setup),
            bracketId,
            createdAtIso: now.toISOString(),
            symbol: setup.symbol,
            direction: setup.direction,
            entryPrice: setup.entryPrice,
            stopLossPrice: setup.stopLossPrice
        });
    }
    buildSetupFingerprint(setup) {
        return [
            setup.symbol,
            setup.direction,
            setup.entryPrice.toFixed(2),
            setup.stopLossPrice.toFixed(2)
        ].join('|');
    }
}
exports.OrderGuardService = OrderGuardService;
//# sourceMappingURL=order-guard-service.js.map