const logger = require('../../log');

type RedisCommandClient = {
    get: (key: string) => Promise<string | null>;
    setEx: (key: string, ttl: number, value: string) => Promise<unknown>;
    del: (key: string | string[]) => Promise<unknown>;
    keys: (pattern: string) => Promise<string[]>;
    flushAll: () => Promise<unknown>;
};

type RedisCommandContext = {
    client: RedisCommandClient;
    isConnected: boolean;
    ensureConnected: () => Promise<boolean>;
    runWithClient: <T>(
        operation: (client: RedisCommandClient) => Promise<T>,
        fallback: T,
        errorMessage: string,
        meta?: Record<string, unknown>
    ) => Promise<T>;
};

const getErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : String(error)
);

const runWithClient = async function <T>(
    this: RedisCommandContext,
    operation: (client: RedisCommandClient) => Promise<T>,
    fallback: T,
    errorMessage: string,
    meta: Record<string, unknown> = {}
): Promise<T> {
    if (!await this.ensureConnected()) {
        return fallback;
    }

    try {
        return await operation(this.client);
    } catch (error) {
        logger.error(errorMessage, { ...meta, error: getErrorMessage(error) });
        this.isConnected = false;
        return fallback;
    }
};

const get = async function (this: RedisCommandContext, key: string): Promise<unknown | null> {
    return await this.runWithClient(async () => {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
    }, null, 'Redis GET 오류', { key });
};

const set = async function (this: RedisCommandContext, key: string, value: unknown, ttl = 3600): Promise<boolean> {
    return await this.runWithClient(async () => {
        const serialized = JSON.stringify(value);
        await this.client.setEx(key, ttl, serialized);
        return true;
    }, false, 'Redis SET 오류', { key });
};

const del = async function (this: RedisCommandContext, key: string): Promise<boolean> {
    return await this.runWithClient(async () => {
        await this.client.del(key);
        return true;
    }, false, 'Redis DEL 오류', { key });
};

const delPattern = async function (this: RedisCommandContext, pattern: string): Promise<boolean> {
    return await this.runWithClient(async () => {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
            await this.client.del(keys);
        }
        return true;
    }, false, 'Redis DEL PATTERN 오류', { pattern });
};

const flush = async function (this: RedisCommandContext): Promise<boolean> {
    return await this.runWithClient(async () => {
        await this.client.flushAll();
        return true;
    }, false, 'Redis FLUSH 오류');
};

module.exports = {
    del,
    delPattern,
    flush,
    get,
    runWithClient,
    set
};

export {};
