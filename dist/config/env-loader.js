"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadEnvFile = loadEnvFile;
const node_fs_1 = __importDefault(require("node:fs"));
function loadEnvFile(filePath) {
    if (!node_fs_1.default.existsSync(filePath)) {
        return {};
    }
    const lines = node_fs_1.default.readFileSync(filePath, 'utf8').split(/\r?\n/);
    const values = {};
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) {
            continue;
        }
        const separatorIndex = trimmedLine.indexOf('=');
        if (separatorIndex <= 0) {
            continue;
        }
        const key = trimmedLine.slice(0, separatorIndex).trim();
        const value = trimmedLine.slice(separatorIndex + 1).trim();
        values[key] = value;
    }
    return values;
}
//# sourceMappingURL=env-loader.js.map