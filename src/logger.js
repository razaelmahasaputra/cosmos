import fs from 'fs';
import path from 'path';

const logsDir = path.resolve(process.cwd(), 'src', 'logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

function getLogFileName() {
    const date = new Date().toISOString().split('T')[0];
    return path.join(logsDir, `logs-${date}.json`);
}

function writeLog(level, message, ...optionalParams) {
    const logFile = getLogFileName();
    
    // Convert errors to string for better JSON serialization
    const parseParam = (param) => {
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
}

const originalConsoleError = console.error;
console.error = function (message, ...optionalParams) {
    writeLog('ERROR', message, ...optionalParams);
    originalConsoleError.apply(console, [message, ...optionalParams]);
};

process.on('uncaughtException', (err) => {
    writeLog('FATAL', err.message, err.stack);
    originalConsoleError('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    writeLog('ERROR', 'Unhandled Rejection', reason);
    originalConsoleError('Unhandled Rejection:', reason);
});
