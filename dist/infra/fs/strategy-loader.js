"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategyLoader = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
class StrategyLoader {
    strategiesDirectoryPath;
    constructor(strategiesDirectoryPath) {
        this.strategiesDirectoryPath = strategiesDirectoryPath;
    }
    loadById(strategyId) {
        const strategyFiles = node_fs_1.default.readdirSync(this.strategiesDirectoryPath)
            .filter((fileName) => fileName.endsWith('.json'));
        for (const fileName of strategyFiles) {
            const fullPath = node_path_1.default.join(this.strategiesDirectoryPath, fileName);
            const strategy = JSON.parse(node_fs_1.default.readFileSync(fullPath, 'utf8'));
            if (strategy.id === strategyId) {
                return strategy;
            }
        }
        throw new Error(`Strategy '${strategyId}' was not found in ${this.strategiesDirectoryPath}.`);
    }
}
exports.StrategyLoader = StrategyLoader;
//# sourceMappingURL=strategy-loader.js.map