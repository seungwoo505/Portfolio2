const { cache, logger } = require('./store');

const getErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : String(error)
);

module.exports = {
    /**
     * @description 캐시 유틸에 값을 저장한다.
     * @param {*} key 입력값
     * @param {*} value 입력값
     * @param {*} ttl 입력값
     * @returns {any} 처리 결과
     */
    set(key: string, value: unknown, ttl = 300): boolean {
        try {
            return cache.set(key, value, ttl);
        } catch (error) {
            logger.error('캐시 설정 실패', { key, error: getErrorMessage(error) });
            return false;
        }
    },

    /**
     * @description 캐시 유틸에서 값을 조회한다.
     * @param {*} key 입력값
     * @returns {any} 처리 결과
     */
    get(key: string): unknown {
        try {
            return cache.get(key);
        } catch (error) {
            logger.error('캐시 조회 실패', { key, error: getErrorMessage(error) });
            return undefined;
        }
    },

    /**
     * @description 캐시 유틸에서 항목을 삭제한다.
     * @param {*} key 입력값
     * @returns {any} 처리 결과
     */
    del(key: string): boolean {
        try {
            return cache.del(key);
        } catch (error) {
            logger.error('캐시 삭제 실패', { key, error: getErrorMessage(error) });
            return false;
        }
    },

    /**
     * @description 캐시 유틸에서 키 존재 여부를 확인한다.
     * @param {*} key 입력값
     * @returns {any} 처리 결과
     */
    has(key: string): boolean {
        return cache.has(key);
    },

    getStats() {
        return cache.getStats();
    },

    /**
     * @description 캐시 유틸의 모든 항목을 삭제한다.
     * @returns {any} 처리 결과
     */
    flush(): void {
        return cache.flushAll();
    },

    /**
     * @description 캐시 유틸에서 패턴에 맞는 키를 삭제한다.
     * @param {*} pattern 입력값
     * @returns {any} 처리 결과
     */
    delPattern(pattern: string): number {
        const keys: string[] = cache.keys();
        const regex = new RegExp(pattern);
        let deletedCount = 0;

        keys.forEach((key) => {
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
    generateKey(prefix: string, ...params: unknown[]): string {
        return `${prefix}:${params.join(':')}`;
    }
};

export {};
