const logger = require('../../log');
const { parseIntegerEnv } = require('../env-number');
const { createRedisClient } = require('./client');

type RedisClientLike = {
    isOpen?: boolean;
    connect: () => Promise<void>;
    quit: () => Promise<void>;
};

const getErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : String(error)
);

class RedisCacheConnection {
    client: RedisClientLike | null;
    isConnected: boolean;
    connectPromise: Promise<boolean> | null;
    lastConnectAttemptAt: number;
    retryDelayMs: number;

    constructor() {
        this.client = null;
        this.isConnected = false;
        this.connectPromise = null;
        this.lastConnectAttemptAt = 0;
        this.retryDelayMs = parseIntegerEnv(process.env.REDIS_RETRY_DELAY_MS, {
            fallback: 30000,
            min: 1000,
            max: 60 * 60 * 1000
        });
    }

    createClient(): RedisClientLike {
        return createRedisClient({
            onConnect: () => {
                this.isConnected = true;
            },
            onError: () => {
                this.isConnected = false;
            },
            onEnd: () => {
                this.isConnected = false;
            }
        });
    }

    async connect({ force = false }: { force?: boolean } = {}): Promise<boolean> {
        if (this.isConnected && this.client?.isOpen) {
            return true;
        }

        const now = Date.now();
        if (!force && this.lastConnectAttemptAt && now - this.lastConnectAttemptAt < this.retryDelayMs) {
            return false;
        }

        if (this.connectPromise) {
            return await this.connectPromise;
        }

        this.lastConnectAttemptAt = now;
        this.connectPromise = (async () => {
            try {
                if (!this.client) {
                    this.client = this.createClient();
                }

                await this.client.connect();
                this.isConnected = true;
                return true;
            } catch (error) {
                logger.warn('Redis Unix 소켓 초기화 실패', { error: getErrorMessage(error) });
                this.isConnected = false;
                this.client = null;
                return false;
            } finally {
                this.connectPromise = null;
            }
        })();

        return await this.connectPromise;
    }

    async init(): Promise<boolean> {
        return await this.connect({ force: true });
    }

    async ensureConnected(): Promise<boolean> {
        return await this.connect();
    }

    async disconnect(): Promise<void> {
        if (this.client) {
            if (this.client.isOpen) {
                await this.client.quit();
            }
            this.client = null;
            this.isConnected = false;
        }
    }
}

module.exports = {
    RedisCacheConnection
};

export {};
