const { cache, logger } = require('./store');

module.exports = {
    /**
     * @description 캐시 유틸에 값을 저장한다.
     * @param {*} key 입력값
     * @param {*} value 입력값
     * @param {*} ttl 입력값
     * @returns {any} 처리 결과
     */
    set(key, value, ttl = 300) {
        try {
            return cache.set(key, value, ttl);
        } catch (error) {
            logger.error('캐시 설정 실패', { key, error: error.message });
            return false;
        }
    },

    /**
     * @description 캐시 유틸에서 값을 조회한다.
     * @param {*} key 입력값
     * @returns {any} 처리 결과
     */
    get(key) {
        try {
            return cache.get(key);
        } catch (error) {
            logger.error('캐시 조회 실패', { key, error: error.message });
            return undefined;
        }
    },

    /**
     * @description 캐시 유틸에서 항목을 삭제한다.
     * @param {*} key 입력값
     * @returns {any} 처리 결과
     */
    del(key) {
        try {
            return cache.del(key);
        } catch (error) {
            logger.error('캐시 삭제 실패', { key, error: error.message });
            return false;
        }
    },

    /**
     * @description 캐시 유틸에서 키 존재 여부를 확인한다.
     * @param {*} key 입력값
     * @returns {any} 처리 결과
     */
    has(key) {
        return cache.has(key);
    },

    getStats() {
        return cache.getStats();
    },

    /**
     * @description 캐시 유틸의 모든 항목을 삭제한다.
     * @returns {any} 처리 결과
     */
    flush() {
        return cache.flushAll();
    },

    /**
     * @description 캐시 유틸에서 패턴에 맞는 키를 삭제한다.
     * @param {*} pattern 입력값
     * @returns {any} 처리 결과
     */
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

    /**
     * @description 캐시 유틸에서 사용할 키를 생성한다.
     * @param {*} prefix 입력값
     * @param {*} params 입력값
     * @returns {any} 처리 결과
     */
    generateKey(prefix, ...params) {
        return `${prefix}:${params.join(':')}`;
    }
};
