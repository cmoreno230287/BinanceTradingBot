"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BotLogger = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
class BotLogger {
    logsDirectoryPath;
    constructor(logsDirectoryPath) {
        this.logsDirectoryPath = logsDirectoryPath;
    }
    info(message, details) {
        this.write('INFO', message, details);
    }
    error(message, details) {
        this.write('ERROR', message, details);
    }
    write(level, message, details) {
        node_fs_1.default.mkdirSync(this.logsDirectoryPath, { recursive: true });
        const now = new Date();
        const timestamp = new Intl.DateTimeFormat('sv-SE', {
            dateStyle: 'short',
            timeStyle: 'medium',
            timeZone: 'America/Bogota'
        }).format(now);
        const fileName = `${formatDateToken(now)}.log`;
        const detailBlock = details === undefined ? '' : ` ${safeStringify(details)}`;
        node_fs_1.default.appendFileSync(node_path_1.default.join(this.logsDirectoryPath, fileName), `[${timestamp}] [${level}] ${message}${detailBlock}\n`, 'utf8');
    }
}
exports.BotLogger = BotLogger;
function formatDateToken(date) {
    const formatter = new Intl.DateTimeFormat('sv-SE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'America/Bogota'
    });
    return formatter.format(date).replaceAll('-', '');
}
function safeStringify(value) {
    try {
        return JSON.stringify(value);
    }
    catch {
        return String(value);
    }
}
//# sourceMappingURL=bot-logger.js.map