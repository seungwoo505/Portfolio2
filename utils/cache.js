const NodeCache = require('node-cache');
const logger = require('../log');

// 🚀 고성능 메모리 캐시 설정
const cache = new NodeCache({
    stdTTL: 600, // 5분 → 10분으로 증가 (캐시 히트율 향상)
    checkperiod: 300, // 2분 → 5분으로 증가 (정리 주기 최적화)
    useClones: false, // 객체 복사 비활성화 (성능 향상)
    deleteOnExpire: true, // 만료 시 자동 삭제
    maxKeys: 2000, // 1000 → 2000으로 증가 (더 많은 캐시 저장)
    forceString: false, // 키를 문자열로 강제 변환하지 않음
    
    // 추가 성능 최적화
    useClones: false, // 객체 복사 비활성화 (메모리 절약)
    enableLegacyCallbacks: false, // 레거시 콜백 비활성화
    arrayValueSize: 100, // 배열 값 크기 제한
    objectValueSize: 1000, // 객체 값 크기 제한
    promiseValueSize: 100, // Promise 값 크기 제한
});

// 캐시 이벤트 리스너 (성능 최적화: debug 로그 제거)
cache.on('flush', () => {
    logger.info('캐시 전체 삭제');
});

// 캐시 헬퍼 함수들
const CacheUtils = {
    // 캐시 설정
    set(key, value, ttl = 300) {
        try {
            return cache.set(key, value, ttl);
        } catch (error) {
            logger.error('캐시 설정 실패', { key, error: error.message });
            return false;
        }
    },

    // 캐시 조회
    get(key) {
        try {
            return cache.get(key);
        } catch (error) {
            logger.error('캐시 조회 실패', { key, error: error.message });
            return undefined;
        }
    },

    // 캐시 삭제
    del(key) {
        try {
            return cache.del(key);
        } catch (error) {
            logger.error('캐시 삭제 실패', { key, error: error.message });
            return false;
        }
    },

    // 캐시 존재 여부 확인
    has(key) {
        return cache.has(key);
    },

    // 캐시 통계
    getStats() {
        return cache.getStats();
    },

    // 캐시 전체 삭제
    flush() {
        return cache.flushAll();
    },

    // 패턴으로 키 삭제
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

    // 캐시 키 생성 헬퍼
    generateKey(prefix, ...params) {
        return `${prefix}:${params.join(':')}`;
    },

    // API 응답 캐싱 헬퍼 (고성능 최적화)
    async cacheApiResponse(key, fetchFunction, ttl = 600) {
        // 캐시에서 먼저 확인
        const cached = this.get(key);
        if (cached !== undefined) {
            return cached;
        }

        // 캐시에 없으면 함수 실행
        try {
            const result = await fetchFunction();
            this.set(key, result, ttl);
            return result;
        } catch (error) {
            logger.error('캐시 API 응답 실패', { key, error: error.message });
            throw error;
        }
    },

    // 배치 캐싱 (여러 키를 한 번에 캐싱)
    async cacheBatch(keys, fetchFunction, ttl = 600) {
        const results = {};
        const missingKeys = [];
        
        // 기존 캐시에서 확인
        for (const key of keys) {
            const cached = this.get(key);
            if (cached !== undefined) {
                results[key] = cached;
            } else {
                missingKeys.push(key);
            }
        }
        
        // 누락된 키들만 새로 가져오기
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

    // 캐시 워밍업 (자주 사용되는 데이터 미리 로드)
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
