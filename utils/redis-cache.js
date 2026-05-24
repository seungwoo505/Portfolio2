const redis = require('redis');
const logger = require('../log');
const { parseIntegerEnv } = require('./env-number');

class RedisCache {
    /**
     * @description Redis 캐시 유틸 인스턴스를 초기화한다.
     * @returns {any} 처리 결과
     */
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

    /**
     * @description Redis 캐시 유틸을 초기화한다.
     * @returns {Promise<any>} 처리 결과
     */
    createClient() {
        const socketPath = process.env.REDIS_SOCKET || '/run/synocached.sock';
        const redisConfig = {
            socket: {
                path: socketPath,
                reconnectStrategy: (retries, cause) => {
                    if (cause?.code === 'ECONNREFUSED') {
                        logger.warn('Redis Unix 소켓 연결 실패, 메모리 캐시를 사용합니다.');
                        return false;
                    }
                    if (retries > 10) {
                        return false;
                    }
                    return Math.min(retries * 100, 3000);
                }
            }
        };

        logger.info('Redis Unix 소켓 연결 시도', { socketPath });

        const client = redis.createClient(redisConfig);

        client.on('connect', () => {
            logger.info('Redis Unix 소켓 연결 성공');
            this.isConnected = true;
        });

        client.on('error', (err) => {
            logger.warn('Redis Unix 소켓 연결 오류', { error: err.message });
            this.isConnected = false;
        });

        client.on('end', () => {
            logger.warn('Redis Unix 소켓 연결 종료');
            this.isConnected = false;
        });

        return client;
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

    async runWithClient(operation, fallback, errorMessage, meta = {}) {
        if (!await this.ensureConnected()) {
            return fallback;
        }

        try {
            return await operation(this.client);
        } catch (error) {
            logger.error(errorMessage, { ...meta, error: error.message });
            this.isConnected = false;
            return fallback;
        }
    }

    /**
     * @description Redis 캐시 유틸에서 값을 조회한다.
      * @param {*} key 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async get(key) {
        return await this.runWithClient(async () => {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        }, null, 'Redis GET 오류', { key });
    }

    /**
     * @description Redis 캐시 유틸에 값을 저장한다.
      * @param {*} key 입력값
      * @param {*} value 입력값
      * @param {*} ttl 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async set(key, value, ttl = 3600) {
        return await this.runWithClient(async () => {
            const serialized = JSON.stringify(value);
            await this.client.setEx(key, ttl, serialized);
            return true;
        }, false, 'Redis SET 오류', { key });
    }

    /**
     * @description Redis 캐시 유틸에서 항목을 삭제한다.
      * @param {*} key 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async del(key) {
        return await this.runWithClient(async () => {
            await this.client.del(key);
            return true;
        }, false, 'Redis DEL 오류', { key });
    }

    /**
     * @description Redis 캐시 유틸에서 패턴에 맞는 키를 삭제한다.
      * @param {*} pattern 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async delPattern(pattern) {
        return await this.runWithClient(async () => {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(keys);
            }
            return true;
        }, false, 'Redis DEL PATTERN 오류', { pattern });
    }

    /**
     * @description Redis 캐시 유틸의 모든 항목을 삭제한다.
     * @returns {Promise<any>} 처리 결과
     */
    async flush() {
        return await this.runWithClient(async () => {
            await this.client.flushAll();
            return true;
        }, false, 'Redis FLUSH 오류');
    }

    /**
     * @description Redis 캐시 유틸의 통계를 조회한다.
     * @returns {Promise<any>} 처리 결과
     */
    async getStats() {
        if (!await this.ensureConnected()) {
            return { connected: false };
        }

        try {
            const info = await this.client.info('memory');
            const dbSize = await this.client.dbSize();
            
            return {
                connected: true,
                dbSize,
                memory: info
            };
        } catch (error) {
            logger.error('Redis 통계 조회 오류', { error: error.message });
            return { connected: false };
        }
    }

    /**
     * @description Redis 캐시 유틸 연결을 종료한다.
     * @returns {Promise<any>} 처리 결과
     */
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

const redisCache = new RedisCache();

module.exports = redisCache;
