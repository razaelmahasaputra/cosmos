import fs from 'fs';
import path from 'path';

const logsDir = path.resolve(process.cwd(), 'src', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

function getLogFileName(): string {
    const date = new Date().toISOString().split('T')[0];
    return path.join(logsDir, `logs-${date}.json`);
}

export function writeLog(level: string, message: any, ...optionalParams: any[]): void {
    const logFile = getLogFileName();

    // Convert errors to string for better JSON serialization
    const parseParam = (param: any) => {
        if (param instanceof Error) {
            return { message: param.message, stack: param.stack };
        }
        return param;
    };

    const logEntry = {
        timestamp: new Date().toISOString(),
        level,
        message: parseParam(message),
        details: optionalParams.length > 0 ? optionalParams.map(parseParam) : undefined
    };

    fs.appendFileSync(logFile, JSON.stringify(logEntry) + '\n');

    // Also print INFO logs to console so it's visible in Pterodactyl terminal
    if (level === 'INFO') {
        const originalConsoleLog = console.log;
        originalConsoleLog(`[INFO] ${message}`, ...(optionalParams.length > 0 ? optionalParams : []));
    }
}

const originalConsoleError = console.error;
console.error = function (message?: any, ...optionalParams: any[]) {
    writeLog('ERROR', message, ...optionalParams);
    originalConsoleError.apply(console, [message, ...optionalParams]);
};

process.on('uncaughtException', (err: Error) => {
    writeLog('FATAL', err.message, err.stack);
    originalConsoleError('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason: any) => {
    writeLog('ERROR', 'Unhandled Rejection', reason);
    originalConsoleError('Unhandled Rejection:', reason);
});
