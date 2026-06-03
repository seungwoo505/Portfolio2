const { logger } = require('./store');

module.exports = {
    /**
     * @description 캐시에 여러 키를 한 번에 저장한다.
     * @param {*} keys 입력값
     * @param {*} fetchFunction 입력값
     * @param {*} ttl 입력값
     * @returns {Promise<any>} 처리 결과
     */
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

    /**
     * @description 캐시 유틸을 미리 로딩한다.
     * @param {*} warmupFunctions 입력값
     * @param {*} ttl 입력값
     * @returns {Promise<any>} 처리 결과
     */
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
