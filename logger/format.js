const winston = require('winston');
const { redact } = require('./redaction');

const formatAdmin = (admin) => {
    if (!admin) {
        return null;
    }

    const username = admin.username || 'unknown';
    return admin.id ? `${username}#${admin.id}` : username;
};

const formatLogValue = (value) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
    return /\s/.test(stringValue) ? JSON.stringify(stringValue) : stringValue;
};

const pickLineFields = (meta) => {
    const fieldOrder = [
        ['requestId', 'req'],
        ['method', 'method'],
        ['path', 'path'],
        ['statusCode', 'status'],
        ['durationMs', 'duration'],
        ['admin', 'admin'],
        ['user', 'user'],
        ['ip', 'ip'],
        ['resourceType', 'resource'],
        ['resourceId', 'resourceId'],
        ['action', 'action']
    ];

    return fieldOrder
        .map(([sourceKey, outputKey]) => {
            let value = meta[sourceKey];
            if (sourceKey === 'durationMs' && value !== undefined && value !== null) {
                value = `${value}ms`;
            }
            if (sourceKey === 'admin') {
                value = formatAdmin(value);
            }
            if (sourceKey === 'user') {
                value = formatAdmin(value);
            }

            const formattedValue = formatLogValue(value);
            return formattedValue ? `${outputKey}=${formattedValue}` : null;
        })
        .filter(Boolean);
};

const compactMeta = (meta) => {
    const compactKeys = new Set([
        'requestId',
        'method',
        'path',
        'statusCode',
        'durationMs',
        'admin',
        'user',
        'ip',
        'resourceType',
        'resourceId',
        'action'
    ]);
    const remaining = Object.fromEntries(
        Object.entries(meta).filter(([key, value]) => !compactKeys.has(key) && value !== undefined && value !== null && value !== '')
    );

    return remaining;
};

const createLogFormat = () => {
    const formats = [
        winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        winston.format.errors({ stack: true })
    ];

    formats.push(winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
        const cleanMeta = redact(meta);
        const lineFields = pickLineFields(cleanMeta);
        const remainingMeta = compactMeta(cleanMeta);

        let log = `${timestamp} ${String(level).toUpperCase()} ${message}`;
        if (lineFields.length > 0) {
            log += ` ${lineFields.join(' ')}`;
        }
        if (Object.keys(remainingMeta).length > 0) {
            log += ` details=${JSON.stringify(remainingMeta)}`;
        }
        if (stack) {
            log += `\n${stack}`;
        }
        return log;
    }));

    return winston.format.combine(...formats);
};

module.exports = {
    createLogFormat
};
