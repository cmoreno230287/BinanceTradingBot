"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TradeJournal = void 0;
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const HEADER = 'Fecha,Hora,Sesion,Direccion,Contexto HTF,Nivel de liquidez barrido,Tipo de confirmacion,Zona de entrada,Stop Loss,Take Profit,R:R,Resultado';
class TradeJournal {
    outputDirectoryPath;
    constructor(outputDirectoryPath) {
        this.outputDirectoryPath = outputDirectoryPath;
    }
    append(record, date) {
        node_fs_1.default.mkdirSync(this.outputDirectoryPath, { recursive: true });
        const monthFileName = `Trades_${formatMonthFileToken(date)}.csv`;
        const filePath = node_path_1.default.join(this.outputDirectoryPath, monthFileName);
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
        const monthFileName = `Trades_${formatMonthFileToken(date)}.csv`;
        const filePath = node_path_1.default.join(this.outputDirectoryPath, monthFileName);
        if (!node_fs_1.default.existsSync(filePath)) {
            return 0;
        }
        const targetDate = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Bogota' }).format(date);
        const lines = node_fs_1.default.readFileSync(filePath, 'utf8')
            .split(/\r?\n/)
            .slice(1)
            .filter((line) => line.trim().length > 0);
        return lines.filter((line) => line.startsWith(`${targetDate},`)).length;
    }
}
exports.TradeJournal = TradeJournal;
function formatMonthFileToken(date) {
    const formatter = new Intl.DateTimeFormat('en-US', {
        month: 'short',
        year: 'numeric',
        timeZone: 'America/Bogota'
    });
    const parts = formatter.formatToParts(date);
    const month = parts.find((part) => part.type === 'month')?.value ?? 'Jan';
    const year = parts.find((part) => part.type === 'year')?.value ?? '1970';
    return `${month}${year}`;
}
function csv(value) {
    return `"${value.replaceAll('"', '""')}"`;
}
//# sourceMappingURL=trade-journal.js.map