"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradePerformanceStore = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const OPEN_TRADES_FILE_NAME = 'open-trades.json';
const PERFORMANCE_REPORT_FILE_NAME = 'trade-performance-report.csv';
const PERFORMANCE_REPORT_HEADER = [
    'SetupId',
    'BracketId',
    'StrategyId',
    'Symbol',
    'Session',
    'Direction',
    'EntryPrice',
    'StopLossPrice',
    'TakeProfitPrice',
    'RiskRewardRatio',
    'ExecutionMode',
    'OpenedAt',
    'ClosedAt',
    'OutcomeStatus'
].join(',');
class TradePerformanceStore {
    stateDirectoryPath;
    reportsDirectoryPath;
    constructor(stateDirectoryPath, reportsDirectoryPath) {
        this.stateDirectoryPath = stateDirectoryPath;
        this.reportsDirectoryPath = reportsDirectoryPath;
    }
    getOpenTrades() {
        const filePath = this.getOpenTradesFilePath();
        if (!node_fs_1.default.existsSync(filePath)) {
            return [];
        }
        return JSON.parse(node_fs_1.default.readFileSync(filePath, 'utf8'));
    }
    getClosedTradesCount() {
        const filePath = this.getPerformanceReportFilePath();
        if (!node_fs_1.default.existsSync(filePath)) {
            return 0;
        }
        return node_fs_1.default.readFileSync(filePath, 'utf8')
            .split(/\r?\n/)
            .slice(1)
            .filter((line) => line.trim().length > 0)
            .filter((line) => {
            const columns = line.split(',');
            const outcomeStatus = columns[13];
            return outcomeStatus === 'TP' || outcomeStatus === 'SL' || outcomeStatus === 'CANCELED';
        }).length;
    }
    saveOpenTrades(records) {
        node_fs_1.default.mkdirSync(this.stateDirectoryPath, { recursive: true });
        node_fs_1.default.writeFileSync(this.getOpenTradesFilePath(), JSON.stringify(records, null, 2), 'utf8');
    }
    addOpenTrade(record) {
        const records = this.getOpenTrades();
        records.push(record);
        this.saveOpenTrades(records);
        this.upsertPerformanceRow(record);
    }
    closeTrade(setupId, closedAtIso, outcomeStatus) {
        const records = this.getOpenTrades();
        const updatedRecords = records.filter((record) => {
            if (record.setupId !== setupId) {
                return true;
            }
            const closedRecord = {
                ...record,
                closedAtIso,
                outcomeStatus
            };
            this.upsertPerformanceRow(closedRecord);
            return false;
        });
        this.saveOpenTrades(updatedRecords);
    }
    upsertPerformanceRow(record) {
        node_fs_1.default.mkdirSync(this.reportsDirectoryPath, { recursive: true });
        const filePath = this.getPerformanceReportFilePath();
        const rows = node_fs_1.default.existsSync(filePath)
            ? node_fs_1.default.readFileSync(filePath, 'utf8').split(/\r?\n/).filter((line) => line.length > 0)
            : [PERFORMANCE_REPORT_HEADER];
        const dataRows = rows.slice(1).filter((row) => !row.startsWith(`${record.setupId},`));
        dataRows.push(this.toCsvRow(record));
        node_fs_1.default.writeFileSync(filePath, [PERFORMANCE_REPORT_HEADER, ...dataRows].join('\n') + '\n', 'utf8');
    }
    toCsvRow(record) {
        return [
            record.setupId,
            record.bracketId,
            record.strategyId,
            record.symbol,
            record.session,
            record.direction,
            record.entryPrice.toFixed(2),
            record.stopLossPrice.toFixed(2),
            record.takeProfitPrice.toFixed(2),
            record.riskRewardRatio.toFixed(2),
            record.executionMode,
            formatLocalDateTime(record.openedAtIso),
            record.closedAtIso ? formatLocalDateTime(record.closedAtIso) : '',
            record.outcomeStatus
        ].join(',');
    }
    getOpenTradesFilePath() {
        return node_path_1.default.join(this.stateDirectoryPath, OPEN_TRADES_FILE_NAME);
    }
    getPerformanceReportFilePath() {
        return node_path_1.default.join(this.reportsDirectoryPath, PERFORMANCE_REPORT_FILE_NAME);
    }
}
exports.TradePerformanceStore = TradePerformanceStore;
function formatLocalDateTime(isoTimestamp) {
    const date = new Date(isoTimestamp);
    const datePart = new Intl.DateTimeFormat('sv-SE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        timeZone: 'America/Bogota'
    }).format(date);
    const timePart = new Intl.DateTimeFormat('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
        timeZone: 'America/Bogota'
    }).format(date);
    return `${datePart} ${timePart}`;
}
//# sourceMappingURL=trade-performance-store.js.map