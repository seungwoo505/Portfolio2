const { logger } = require('./store');

type CacheContext = {
    get: (key: string) => unknown;
    set: (key: string, value: unknown, ttl?: number) => boolean;
};

const getErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : String(error)
);

const pendingCacheLoads = new Map<string, Promise<unknown>>();

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
            return await pendingLoad;
        }

        const loadPromise = (async () => {
            try {
                const result = await fetchFunction();
                this.set(key, result, ttl);
                return result;
            } catch (error) {
                logger.error('캐시 API 응답 실패', { key, error: getErrorMessage(error) });
                throw error;
            } finally {
                pendingCacheLoads.delete(key);
            }
        })();

        pendingCacheLoads.set(key, loadPromise);
        return await loadPromise;
    }
};

export {};
