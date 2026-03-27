"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeJournal = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const HEADER = 'Fecha,Hora,Sesion,Direccion,Contexto HTF,Nivel de liquidez barrido,Tipo de confirmacion,Zona de entrada,Stop Loss,Take Profit,R:R,Resultado';
const MAX_ROWS_PER_FILE = 3000;
const JOURNAL_FILE_PREFIX = 'Trades';
const JOURNAL_FILE_PATTERN = /^Trades_(\d{4})\.csv$/i;
class TradeJournal {
    outputDirectoryPath;
    constructor(outputDirectoryPath) {
        this.outputDirectoryPath = outputDirectoryPath;
    }
    append(record, _date) {
        node_fs_1.default.mkdirSync(this.outputDirectoryPath, { recursive: true });
        const filePath = this.resolveWritableJournalFilePath();
        const row = [
            record.date,
            record.time,
            record.session,
            record.direction,
            csv(record.htfContext),
            csv(record.sweptLiquidity),
            record.confirmationType,
            csv(record.entryZone),
            record.stopLoss.toFixed(2),
            record.takeProfit.toFixed(2),
            record.riskRewardRatio.toFixed(2),
            csv(record.result)
        ].join(',');
        if (!node_fs_1.default.existsSync(filePath)) {
            node_fs_1.default.writeFileSync(filePath, `${HEADER}\n${row}\n`, 'utf8');
            return;
        }
        node_fs_1.default.appendFileSync(filePath, `${row}\n`, 'utf8');
    }
    countEntriesForDate(date) {
        const targetDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(date);
        let count = 0;
        for (const filePath of this.getJournalFilePaths()) {
            const lines = node_fs_1.default.readFileSync(filePath, 'utf8')
                .split(/\r?\n/)
                .slice(1)
                .filter((line) => line.trim().length > 0);
            count += lines.filter((line) => line.startsWith(`${targetDate},`)).length;
        }
        return count;
    }
    updateResultForTrade(record) {
        const filePaths = this.getJournalFilePaths().reverse();
        for (const filePath of filePaths) {
            const lines = node_fs_1.default.readFileSync(filePath, 'utf8').split(/\r?\n/);
            let targetIndex = -1;
            for (let index = lines.length - 1; index >= 1; index -= 1) {
                const line = lines[index];
                if (!line.trim()) {
                    continue;
                }
                const columns = parseCsvLine(line);
                if (columns.length < 12) {
                    continue;
                }
                const direction = columns[3];
                const stopLoss = columns[8];
                const takeProfit = columns[9];
                const result = columns[11];
                if (direction === record.direction &&
                    stopLoss === record.stopLossPrice.toFixed(2) &&
                    takeProfit === record.takeProfitPrice.toFixed(2) &&
                    (result === 'TestValidated' || result === 'Submitted')) {
                    targetIndex = index;
                    columns[11] = record.outcomeStatus;
                    lines[index] = toCsvLine(columns);
                    break;
                }
            }
            if (targetIndex >= 0) {
                node_fs_1.default.writeFileSync(filePath, lines.join('\n'), 'utf8');
                return;
            }
        }
    }
    resolveWritableJournalFilePath() {
        const files = this.getJournalFilePaths();
        if (files.length === 0) {
            return node_path_1.default.join(this.outputDirectoryPath, `${JOURNAL_FILE_PREFIX}_0001.csv`);
        }
        const latestPath = files[files.length - 1];
        const rowCount = this.countDataRows(latestPath);
        if (rowCount < MAX_ROWS_PER_FILE) {
            return latestPath;
        }
        const latestName = node_path_1.default.basename(latestPath);
        const match = latestName.match(JOURNAL_FILE_PATTERN);
        const currentIndex = match ? Number(match[1]) : files.length;
        const nextIndex = currentIndex + 1;
        const nextName = `${JOURNAL_FILE_PREFIX}_${String(nextIndex).padStart(4, '0')}.csv`;
        return node_path_1.default.join(this.outputDirectoryPath, nextName);
    }
    getJournalFilePaths() {
        if (!node_fs_1.default.existsSync(this.outputDirectoryPath)) {
            return [];
        }
        const csvFiles = node_fs_1.default.readdirSync(this.outputDirectoryPath)
            .filter((fileName) => fileName.toLowerCase().endsWith('.csv'))
            .filter((fileName) => fileName.startsWith(`${JOURNAL_FILE_PREFIX}_`))
            .map((fileName) => ({
            fileName,
            fullPath: node_path_1.default.join(this.outputDirectoryPath, fileName),
            index: this.extractFileIndex(fileName)
        }))
            .sort((a, b) => a.index - b.index)
            .map((item) => item.fullPath);
        if (csvFiles.length > 0) {
            return csvFiles;
        }
        // Backward compatibility for legacy monthly naming.
        return node_fs_1.default.readdirSync(this.outputDirectoryPath)
            .filter((fileName) => fileName.toLowerCase().endsWith('.csv'))
            .filter((fileName) => fileName.startsWith(`${JOURNAL_FILE_PREFIX}_`))
            .sort((a, b) => a.localeCompare(b))
            .map((fileName) => node_path_1.default.join(this.outputDirectoryPath, fileName));
    }
    extractFileIndex(fileName) {
        const match = fileName.match(JOURNAL_FILE_PATTERN);
        if (match) {
            return Number(match[1]);
        }
        return Number.MAX_SAFE_INTEGER;
    }
    countDataRows(filePath) {
        if (!node_fs_1.default.existsSync(filePath)) {
            return 0;
        }
        return node_fs_1.default.readFileSync(filePath, 'utf8')
            .split(/\r?\n/)
            .slice(1)
            .filter((line) => line.trim().length > 0).length;
    }
}
exports.TradeJournal = TradeJournal;
function csv(value) {
    return `"${value.replaceAll('"', '""')}"`;
}
function parseCsvLine(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    for (let index = 0; index < line.length; index += 1) {
        const character = line[index];
        if (character === '"') {
            if (inQuotes && line[index + 1] === '"') {
                current += '"';
                index += 1;
            }
            else {
                inQuotes = !inQuotes;
            }
            continue;
        }
        if (character === ',' && !inQuotes) {
            values.push(current);
            current = '';
            continue;
        }
        current += character;
    }
    values.push(current);
    return values;
}
function toCsvLine(columns) {
    return columns.map((value, index) => {
        if ([4, 5, 7, 11].includes(index)) {
            return csv(value);
        }
        return value;
    }).join(',');
}
//# sourceMappingURL=trade-journal.js.map