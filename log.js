require('dotenv').config({ quiet: true });

const fs = require('fs');
const path = require('path');
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');

const logDir = path.join(__dirname, 'logs');
fs.promises.mkdir(logDir, { recursive: true })
    .catch(error => {
        console.error(`Failed to create log directory ${logDir}`, error);
    });

const isVerboseEnabled = process.env.ENABLE_VERBOSE_LOGS === 'true';
const slowRequestMs = parseInt(process.env.SLOW_REQUEST_MS || '1000', 10) || 1000;
const sensitiveKeys = new Set([
    'authorization',
    'cookie',
    'password',
    'oldpassword',
    'newpassword',
    'password_hash',
    'token',
    'refreshtoken',
    'refresh_token',
    'x-refresh-token',
    'jwt',
    'secret',
    'api_key',
    'apikey'
]);
const sensitiveKeyFragments = ['password', 'token', 'secret', 'authorization', 'cookie'];

const transport = new DailyRotateFile({
    dirname: logDir,
    filename: '%DATE%.log',
    datePattern: 'YYYY-MM-DD',
    zippedArchive: false,
    maxSize: process.env.LOG_MAX_SIZE || '20m',
    maxFiles: process.env.LOG_MAX_FILES || '14d'
});

const normalizeError = (error) => ({
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    errno: error.errno,
    sqlState: error.sqlState
});

const redact = (value, seen = new WeakSet()) => {
    if (value === null || value === undefined) {
        return value;
    }

    if (value instanceof Error) {
        return normalizeError(value);
    }

    if (value instanceof Date) {
        return value.toISOString();
    }

    if (Array.isArray(value)) {
        return value.map(item => redact(item, seen));
    }

    if (typeof value !== 'object') {
        return value;
    }

    if (seen.has(value)) {
        return '[Circular]';
    }
    seen.add(value);

    return Object.fromEntries(
        Object.entries(value).map(([key, item]) => {
            const normalizedKey = key.toLowerCase().replace(/[-_\s]/g, '');
            const isSensitive = sensitiveKeys.has(key.toLowerCase()) ||
                sensitiveKeys.has(normalizedKey) ||
                sensitiveKeyFragments.some(fragment => normalizedKey.includes(fragment));

            if (isSensitive) {
                return [key, '[REDACTED]'];
            }
            return [key, redact(item, seen)];
        })
    );
};

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

const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: createLogFormat(),
    transports: [
        transport,
        new winston.transports.Console({
            format: createLogFormat()
        })
    ]
});

const adminFromRequest = (req) => {
    if (!req?.admin) {
        return null;
    }

    return {
        id: req.admin.id,
        username: req.admin.username,
        role: req.admin.role
    };
};

const requestMeta = (req, extra = {}) => ({
    requestId: req?.requestId,
    method: req?.method,
    path: req?.originalUrl || req?.url,
    ip: req?.ip || req?.connection?.remoteAddress,
    admin: adminFromRequest(req),
    ...extra
});

logger.redact = redact;
logger.isVerboseEnabled = () => isVerboseEnabled;
logger.getSlowRequestMs = () => slowRequestMs;

logger.request = (req, message = 'API 요청') => {
    if (!isVerboseEnabled) {
        return;
    }

    logger.debug(message, requestMeta(req, {
        body: req.method !== 'GET' ? redact(req.body) : undefined,
        query: Object.keys(req.query || {}).length > 0 ? redact(req.query) : undefined
    }));
};

logger.response = (req, res, message = 'API 응답') => {
    if (!isVerboseEnabled) {
        return;
    }

    logger.debug(message, requestMeta(req, {
        statusCode: res.statusCode,
        responseTime: res.get('X-Response-Time')
    }));
};

logger.requestSummary = (req, res, { durationMs }) => {
    const statusCode = res.statusCode;
    const isAdminApi = req.path.startsWith('/api/admin');
    const isDataModifying = ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
    const isAuthEndpoint = req.path.includes('/login') || req.path.includes('/logout');
    const isSlow = durationMs >= slowRequestMs;
    const shouldLog = isVerboseEnabled || isAdminApi || isDataModifying || isAuthEndpoint || statusCode >= 400 || isSlow;

    if (!shouldLog) {
        return;
    }

    const meta = requestMeta(req, {
        statusCode,
        durationMs
    });

    if (statusCode >= 500) {
        logger.error('request.error', meta);
    } else if (statusCode >= 400) {
        logger.warn('request.warn', meta);
    } else if (isSlow) {
        logger.warn('request.slow', meta);
    } else {
        logger.info('request.ok', meta);
    }
};

logger.audit = (action, details = {}, user = null) => {
    logger.info('audit.admin', {
        action,
        user: user ? { id: user.id, username: user.username, role: user.role } : null,
        ...redact(details)
    });
};

logger.activity = (action, details = {}, user = null) => {
    if (!isVerboseEnabled) {
        return;
    }

    logger.info(`[활동] ${action}`, {
        action,
        user: user ? { id: user.id, username: user.username, role: user.role } : null,
        ...redact(details)
    });
};

logger.auth = (message, user = null, extra = {}) => {
    if (!isVerboseEnabled) {
        return;
    }

    logger.info(`[인증] ${message}`, {
        user: user ? { id: user.id, username: user.username, role: user.role } : null,
        ...redact(extra)
    });
};

logger.security = (message, extra = {}) => {
    logger.warn('security.warn', {
        message,
        ...redact(extra)
    });
};

logger.admin = (message, admin = null, extra = {}) => {
    if (!isVerboseEnabled) {
        return;
    }

    logger.info(`[관리자] ${message}`, {
        admin: admin ? { id: admin.id, username: admin.username, role: admin.role } : null,
        ...redact(extra)
    });
};

logger.database = (operation, details = {}, maybeDetails = {}) => {
    const meta = typeof details === 'string'
        ? { table: details, ...maybeDetails }
        : details;
    const isFailure = String(operation).includes('실패') || String(operation).toLowerCase().includes('error');

    if (!isVerboseEnabled && !isFailure) {
        return;
    }

    logger[isFailure ? 'error' : 'debug'](`[데이터베이스] ${operation}`, redact(meta));
};

logger.stats = {
    counters: {
        totalRequests: 0,
        adminRequests: 0,
        publicRequests: 0,
        loginAttempts: 0,
        loginSuccess: 0,
        loginFailures: 0,
        errors: 0,
        slowRequests: 0
    },

    updateStats(type, value = 1) {
        if (Object.prototype.hasOwnProperty.call(this.counters, type)) {
            this.counters[type] += value;
        }
    },

    resetStats() {
        Object.keys(this.counters).forEach(key => {
            this.counters[key] = 0;
        });
    },

    logStats() {
        logger.info('시스템 통계', {
            stats: this.counters,
            timestamp: new Date().toISOString()
        });
    }
};

logger.incrementCounter = (type, value = 1) => {
    logger.stats.updateStats(type, value);
};

const statsInterval = setInterval(() => {
    if (isVerboseEnabled) {
        logger.stats.logStats();
        logger.stats.resetStats();
    }
}, 60 * 60 * 1000);
statsInterval.unref?.();

module.exports = logger;
