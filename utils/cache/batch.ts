const { logger } = require('./store');

type CacheBatchContext = {
    get: (key: string) => unknown;
    set: (key: string, value: unknown, ttl?: number) => boolean;
};

type CacheBatchResult = Record<string, unknown>;
type CacheBatchFetcher = (keys: string[]) => Promise<CacheBatchResult> | CacheBatchResult;
type CacheWarmupResult = {
    key: string;
    data: unknown;
};
type CacheWarmupFunction = () => Promise<CacheWarmupResult> | CacheWarmupResult;

const getErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : String(error)
);

module.exports = {
    /**
     * @description 캐시에 여러 키를 한 번에 저장한다.
     * @param {*} keys 입력값
     * @param {*} fetchFunction 입력값
     * @param {*} ttl 입력값
     * @returns {Promise<any>} 처리 결과
     */
    async cacheBatch(
        this: CacheBatchContext,
        keys: string[],
        fetchFunction: CacheBatchFetcher,
        ttl = 600
    ): Promise<CacheBatchResult> {
        const results: CacheBatchResult = {};
        const missingKeys: string[] = [];

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
                logger.error('배치 캐시 실패', { keys: missingKeys, error: getErrorMessage(error) });
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
    async warmupCache(
        this: CacheBatchContext,
        warmupFunctions: CacheWarmupFunction[],
        ttl = 600
    ): Promise<void> {
        const promises = warmupFunctions.map(async (func) => {
            try {
                const { key, data } = await func();
                this.set(key, data, ttl);
            } catch (error) {
                logger.error('캐시 워밍업 실패', { error: getErrorMessage(error) });
            }
        });

        await Promise.allSettled(promises);
    }
};

export {};
