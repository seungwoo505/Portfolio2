require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const DailyRotateFile = require('winston-daily-rotate-file');
const { parseIntegerEnv } = require('../utils/env-number');

const logDir = path.join(__dirname, '..', 'logs');
fs.promises.mkdir(logDir, { recursive: true })
    .catch((error: unknown) => {
        console.error(`Failed to create log directory ${logDir}`, error);
    });

const isVerboseEnabled = process.env.ENABLE_VERBOSE_LOGS === 'true';
const slowRequestMs = parseIntegerEnv(process.env.SLOW_REQUEST_MS, {
    fallback: 1000,
    min: 1,
    clamp: false
});

const transport = new DailyRotateFile({
    dirname: logDir,
    filename: '%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d'
});

module.exports = {
    isVerboseEnabled,
    slowRequestMs,
    transport
};

export {};
