const attachDomainLoggers = (logger, isVerboseEnabled) => {
    logger.audit = (action, details = {}, user = null) => {
        logger.info('audit.admin', {
            action,
            user: user ? { id: user.id, username: user.username, role: user.role } : null,
            ...logger.redact(details)
        });
    };

    logger.activity = (action, details = {}, user = null) => {
        if (!isVerboseEnabled) {
            return;
        }

        logger.info(`[활동] ${action}`, {
            action,
            user: user ? { id: user.id, username: user.username, role: user.role } : null,
            ...logger.redact(details)
        });
    };

    logger.auth = (message, user = null, extra = {}) => {
        if (!isVerboseEnabled) {
            return;
        }

        logger.info(`[인증] ${message}`, {
            user: user ? { id: user.id, username: user.username, role: user.role } : null,
            ...logger.redact(extra)
        });
    };

    logger.security = (message, extra = {}) => {
        logger.warn('security.warn', {
            message,
            ...logger.redact(extra)
        });
    };

    logger.admin = (message, admin = null, extra = {}) => {
        if (!isVerboseEnabled) {
            return;
        }

        logger.info(`[관리자] ${message}`, {
            admin: admin ? { id: admin.id, username: admin.username, role: admin.role } : null,
            ...logger.redact(extra)
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

        logger[isFailure ? 'error' : 'debug'](`[데이터베이스] ${operation}`, logger.redact(meta));
    };
};

module.exports = {
    attachDomainLoggers
};
