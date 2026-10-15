const { logger, pendingCacheLoads } = require('./store');

type CacheContext = {
    get: (key: string) => unknown;
    set: (key: string, value: unknown, ttl?: number) => boolean;
};

const getErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : String(error)
);

module.exports = {
    async cacheApiResponse(
        this: CacheContext,
        key: string,
        fetchFunction: () => Promise<unknown> | unknown,
        ttl = 600
    ): Promise<unknown> {
        const cached = this.get(key);
        if (cached !== undefined) {
            return cached;
        }

        const pendingLoad = pendingCacheLoads.get(key);
        if (pendingLoad) {
            return await pendingLoad.promise;
        }

        const load = {
            promise: null as Promise<unknown> | null,
            invalidated: false
        };
        pendingCacheLoads.set(key, load);
        load.promise = (async () => {
            try {
                const result = await fetchFunction();
                // 무효화 이전에 시작한 조회가 오래된 데이터를 다시 저장하지 않게 한다.
                if (!load.invalidated) {
                    this.set(key, result, ttl);
                }
                return result;
            } catch (error) {
                logger.error('캐시 API 응답 실패', { key, error: getErrorMessage(error) });
                throw error;
            } finally {
                if (pendingCacheLoads.get(key) === load) {
                    pendingCacheLoads.delete(key);
                }
            }
        })();

        return await load.promise;
    }
};

export {};
