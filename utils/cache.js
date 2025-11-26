const NodeCache = require('node-cache');
const logger = require('../log');

const cache = new NodeCache({
    stdTTL: 600, // 5분 → 10분으로 증가 (캐시 히트율 향상)
    checkperiod: 300, // 2분 → 5분으로 증가 (정리 주기 최적화)
    useClones: false, // 객체 복사 비활성화 (성능 향상)
    deleteOnExpire: true, // 만료 시 자동 삭제
    maxKeys: 2000, // 1000 → 2000으로 증가 (더 많은 캐시 저장)
    forceString: false, // 키를 문자열로 강제 변환하지 않음
    
    useClones: false, // 객체 복사 비활성화 (메모리 절약)
    enableLegacyCallbacks: false, // 레거시 콜백 비활성화
    arrayValueSize: 100, // 배열 값 크기 제한
    objectValueSize: 1000, // 객체 값 크기 제한
    promiseValueSize: 100, // Promise 값 크기 제한
});

cache.on('flush', () => {
    logger.info('캐시 전체 삭제');
});

const CacheUtils = {
    set(key, value, ttl = 300) {
        try {
            return cache.set(key, value, ttl);
        } catch (error) {
            logger.error('캐시 설정 실패', { key, error: error.message });
            return false;
        }
    },

    get(key) {
        try {
            return cache.get(key);
        } catch (error) {
            logger.error('캐시 조회 실패', { key, error: error.message });
            return undefined;
        }
    },

    del(key) {
        try {
            return cache.del(key);
        } catch (error) {
            logger.error('캐시 삭제 실패', { key, error: error.message });
            return false;
        }
    },

    has(key) {
        return cache.has(key);
    },

    getStats() {
        return cache.getStats();
    },

    flush() {
        return cache.flushAll();
    },

    delPattern(pattern) {
        const keys = cache.keys();
        const regex = new RegExp(pattern);
        let deletedCount = 0;
        
        keys.forEach(key => {
            if (regex.test(key)) {
                if (cache.del(key)) {
                    deletedCount++;
                }
            }
        });
        
        logger.info('패턴 캐시 삭제', { pattern, deletedCount });
        return deletedCount;
    },

    generateKey(prefix, ...params) {
        return `${prefix}:${params.join(':')}`;
    },

    async cacheApiResponse(key, fetchFunction, ttl = 600) {
        const cached = this.get(key);
        if (cached !== undefined) {
            return cached;
        }

        try {
            const result = await fetchFunction();
            this.set(key, result, ttl);
            return result;
        } catch (error) {
            logger.error('캐시 API 응답 실패', { key, error: error.message });
            throw error;
        }
    },

    async cacheBatch(keys, fetchFunction, ttl = 600) {
        const results = {};
        const missingKeys = [];
        
        for (const key of keys) {
            const cached = this.get(key);
            if (cached !== undefined) {
                results[key] = cached;
            } else {
                missingKeys.push(key);
            }
        }
        
        if (missingKeys.length > 0) {
            try {
                const newData = await fetchFunction(missingKeys);
                for (const key of missingKeys) {
                    if (newData[key] !== undefined) {
                        this.set(key, newData[key], ttl);
                        results[key] = newData[key];
                    }
                }
            } catch (error) {
                logger.error('배치 캐시 실패', { keys: missingKeys, error: error.message });
            }
        }
        
        return results;
    },

    async warmupCache(warmupFunctions, ttl = 600) {
        const promises = warmupFunctions.map(async (func) => {
            try {
                const { key, data } = await func();
                this.set(key, data, ttl);
            } catch (error) {
                logger.error('캐시 워밍업 실패', { error: error.message });
            }
        });
        
        await Promise.allSettled(promises);
    }
};

module.exports = CacheUtils;
