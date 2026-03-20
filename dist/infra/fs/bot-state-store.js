"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotStateStore = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const STATE_FILE_NAME = 'bot-state.json';
class BotStateStore {
    stateDirectoryPath;
    constructor(stateDirectoryPath) {
        this.stateDirectoryPath = stateDirectoryPath;
    }
    hasRecentOrder(setupId, setupFingerprint, cooldownMinutes, now) {
        const state = this.readState();
        const cutoff = now.getTime() - cooldownMinutes * 60_000;
        state.recentOrders = state.recentOrders.filter((record) => new Date(record.createdAtIso).getTime() >= cutoff);
        this.writeState(state);
        return state.recentOrders.some((record) => record.setupId === setupId ||
            record.setupFingerprint === setupFingerprint);
    }
    addRecentOrder(record) {
        const state = this.readState();
        state.recentOrders.push(record);
        this.writeState(state);
    }
    readState() {
        const filePath = this.getFilePath();
        if (!node_fs_1.default.existsSync(filePath)) {
            return { recentOrders: [] };
        }
        const payload = node_fs_1.default.readFileSync(filePath, 'utf8');
        return JSON.parse(payload);
    }
    writeState(state) {
        node_fs_1.default.mkdirSync(this.stateDirectoryPath, { recursive: true });
        node_fs_1.default.writeFileSync(this.getFilePath(), JSON.stringify(state, null, 2), 'utf8');
    }
    getFilePath() {
        return node_path_1.default.join(this.stateDirectoryPath, STATE_FILE_NAME);
    }
}
exports.BotStateStore = BotStateStore;
//# sourceMappingURL=bot-state-store.js.map