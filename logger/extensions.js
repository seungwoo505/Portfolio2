const { redact } = require('./redaction');

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

const attachStats = (logger, isVerboseEnabled) => {
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
};

const attachLoggerExtensions = (logger, { isVerboseEnabled, slowRequestMs }) => {
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

    attachStats(logger, isVerboseEnabled);
};

module.exports = {
    attachLoggerExtensions
};
