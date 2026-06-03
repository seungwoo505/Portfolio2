const logger = require('../../log');
const { parseIntegerEnv } = require('../env-number');
const { createRedisClient } = require('./client');

class RedisCacheConnection {
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

    createClient() {
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

    async connect({ force = false } = {}) {
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
                logger.warn('Redis Unix 소켓 초기화 실패', { error: error.message });
                this.isConnected = false;
                this.client = null;
                return false;
            } finally {
                this.connectPromise = null;
            }
        })();

        return await this.connectPromise;
    }

    async init() {
        return await this.connect({ force: true });
    }

    async ensureConnected() {
        return await this.connect();
    }

    async disconnect() {
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
