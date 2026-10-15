require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const DailyRotateFile = require('winston-daily-rotate-file');
const { parseIntegerEnv } = require('../utils/env-number');

const reportedErrors = new WeakSet<object>();
const reportLoggerError = (error: unknown): void => {
    if (typeof error === 'object' && error !== null) {
        if (reportedErrors.has(error)) {
            return;
        }
        reportedErrors.add(error);
    }

    const detail = error instanceof Error ? error.message : String(error);
    const code = (error as NodeJS.ErrnoException)?.code;
    const message = `로그 기록 오류${code ? ` (${code})` : ''}: ${detail}`;
    try {
        console.error(message);
    } catch {
        try {
            fs.writeSync(2, `${message}\n`);
        } catch {
            // 오류 보고 실패가 애플리케이션을 종료시키지 않도록 한다.
        }
    }
};

const logDir = path.join(__dirname, '..', 'logs');
Promise.resolve()
    .then(() => fs.promises.mkdir(logDir, { recursive: true }))
    .catch(reportLoggerError);

const isVerboseEnabled = process.env.ENABLE_VERBOSE_LOGS === 'true';
const slowRequestMs = parseIntegerEnv(process.env.SLOW_REQUEST_MS, {
    fallback: 1000,
    min: 1,
    clamp: false
});

let transport = null;
try {
    transport = new DailyRotateFile({
        dirname: logDir,
        filename: '%DATE%.log',
        datePattern: 'YYYY-MM-DD',
        zippedArchive: false,
        maxSize: process.env.LOG_MAX_SIZE || '20m',
        maxFiles: process.env.LOG_MAX_FILES || '14d'
    });
    // 일반 파일 쓰기 오류는 DailyRotateFile transport로 자동 전달되지 않는다.
    transport.logStream.on('error', reportLoggerError);
    transport.on('error', reportLoggerError);
} catch (error) {
    reportLoggerError(error);
}

module.exports = {
    isVerboseEnabled,
    reportLoggerError,
    slowRequestMs,
    transport
};

export {};
