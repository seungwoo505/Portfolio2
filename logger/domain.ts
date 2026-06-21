type LogUser = {
    id?: number | string;
    username?: string;
    role?: string;
} | null;

const userMeta = (user: LogUser) => (
    user ? { id: user.id, username: user.username, role: user.role } : null
);

const attachDomainLoggers = (logger: any, isVerboseEnabled: boolean): void => {
    logger.audit = (action: string, details: Record<string, unknown> = {}, user: LogUser = null) => {
        logger.info('audit.admin', {
            action,
            user: userMeta(user),
            ...logger.redact(details)
        });
    };

    logger.activity = (action: string, details: Record<string, unknown> = {}, user: LogUser = null) => {
        if (!isVerboseEnabled) {
            return;
        }

        logger.info(`[활동] ${action}`, {
            action,
            user: userMeta(user),
            ...logger.redact(details)
        });
    };

    logger.auth = (message: string, user: LogUser = null, extra: Record<string, unknown> = {}) => {
        if (!isVerboseEnabled) {
            return;
        }

        logger.info(`[인증] ${message}`, {
            user: userMeta(user),
            ...logger.redact(extra)
        });
    };

    logger.security = (message: string, extra: Record<string, unknown> = {}) => {
        logger.warn('security.warn', {
            message,
            ...logger.redact(extra)
        });
    };

    logger.admin = (message: string, admin: LogUser = null, extra: Record<string, unknown> = {}) => {
        if (!isVerboseEnabled) {
            return;
        }

        logger.info(`[관리자] ${message}`, {
            admin: userMeta(admin),
            ...logger.redact(extra)
        });
    };

    logger.database = (
        operation: string,
        details: Record<string, unknown> | string = {},
        maybeDetails: Record<string, unknown> = {}
    ) => {
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

export {};
