const redis = require('redis');
const logger = require('../log');

class RedisCache {
    /**
     * @description Redis 캐시 유틸 인스턴스를 초기화한다.
     * @returns {any} 처리 결과
     */
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.init();
    }

    /**
     * @description Redis 캐시 유틸을 초기화한다.
     * @returns {Promise<any>} 처리 결과
     */
    async init() {
        try {
            const redisConfig = {
                socket: { path: process.env.REDIS_SOCKET || '/run/synocached.sock' },
                retry_strategy: (options) => {
                    if (options.error && options.error.code === 'ECONNREFUSED') {
                        logger.warn('Redis Unix 소켓 연결 실패, 메모리 캐시를 사용합니다.');
                        return new Error('Redis Unix 소켓 연결 실패');
                    }
                    if (options.total_retry_time > 1000 * 60 * 60) {
                        return new Error('Redis 재시도 시간 초과');
                    }
                    if (options.attempt > 10) {
                        return undefined;
                    }
                    return Math.min(options.attempt * 100, 3000);
                }
            };

            logger.info('Redis Unix 소켓 연결 시도:', process.env.REDIS_SOCKET || '/run/synocached.sock');

            this.client = redis.createClient(redisConfig);

            this.client.on('connect', () => {
                logger.info('Redis Unix 소켓 연결 성공');
                this.isConnected = true;
            });

            this.client.on('error', (err) => {
                logger.warn('Redis Unix 소켓 연결 오류', { error: err.message });
                this.isConnected = false;
            });

            this.client.on('end', () => {
                logger.warn('Redis Unix 소켓 연결 종료');
                this.isConnected = false;
            });

            await this.client.connect();
        } catch (error) {
            logger.warn('Redis Unix 소켓 초기화 실패', { error: error.message });
            this.isConnected = false;
        }
    }

    /**
     * @description Redis 캐시 유틸에서 값을 조회한다.
      * @param {*} key 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async get(key) {
        if (!this.isConnected || !this.client) {
            return null;
        }

        try {
            const value = await this.client.get(key);
            return value ? JSON.parse(value) : null;
        } catch (error) {
            logger.error('Redis GET 오류', { key, error: error.message });
            return null;
        }
    }

    /**
     * @description Redis 캐시 유틸에 값을 저장한다.
      * @param {*} key 입력값
      * @param {*} value 입력값
      * @param {*} ttl 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async set(key, value, ttl = 3600) {
        if (!this.isConnected || !this.client) {
            return false;
        }

        try {
            const serialized = JSON.stringify(value);
            await this.client.setEx(key, ttl, serialized);
            return true;
        } catch (error) {
            logger.error('Redis SET 오류', { key, error: error.message });
            return false;
        }
    }

    /**
     * @description Redis 캐시 유틸에서 항목을 삭제한다.
      * @param {*} key 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async del(key) {
        if (!this.isConnected || !this.client) {
            return false;
        }

        try {
            await this.client.del(key);
            return true;
        } catch (error) {
            logger.error('Redis DEL 오류', { key, error: error.message });
            return false;
        }
    }

    /**
     * @description Redis 캐시 유틸에서 패턴에 맞는 키를 삭제한다.
      * @param {*} pattern 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async delPattern(pattern) {
        if (!this.isConnected || !this.client) {
            return false;
        }

        try {
            const keys = await this.client.keys(pattern);
            if (keys.length > 0) {
                await this.client.del(keys);
            }
            return true;
        } catch (error) {
            logger.error('Redis DEL PATTERN 오류', { pattern, error: error.message });
            return false;
        }
    }

    /**
     * @description Redis 캐시 유틸의 모든 항목을 삭제한다.
     * @returns {Promise<any>} 처리 결과
     */
    async flush() {
        if (!this.isConnected || !this.client) {
            return false;
        }

        try {
            await this.client.flushAll();
            return true;
        } catch (error) {
            logger.error('Redis FLUSH 오류', { error: error.message });
            return false;
        }
    }

    /**
     * @description Redis 캐시 유틸의 통계를 조회한다.
     * @returns {Promise<any>} 처리 결과
     */
    async getStats() {
        if (!this.isConnected || !this.client) {
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
            return { connected: false, error: error.message };
        }
    }

    /**
     * @description Redis 캐시 유틸 연결을 종료한다.
     * @returns {Promise<any>} 처리 결과
     */
    async disconnect() {
        if (this.client && this.isConnected) {
            await this.client.quit();
            this.isConnected = false;
        }
    }
}

const redisCache = new RedisCache();

module.exports = redisCache;
