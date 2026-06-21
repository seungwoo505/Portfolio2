type ErrorLike = Error & {
    code?: unknown;
    errno?: unknown;
    sqlState?: unknown;
};

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

const normalizeError = (error: ErrorLike) => ({
    name: error.name,
    message: error.message,
    stack: error.stack,
    code: error.code,
    errno: error.errno,
    sqlState: error.sqlState
});

const redact = (value: unknown, seen = new WeakSet<object>()): unknown => {
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
        return value.map((item) => redact(item, seen));
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
                sensitiveKeyFragments.some((fragment) => normalizedKey.includes(fragment));

            if (isSensitive) {
                return [key, '[REDACTED]'];
            }
            return [key, redact(item, seen)];
        })
    );
};

module.exports = {
    redact
};

export {};
