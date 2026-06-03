const { logger } = require('./store');

const pendingCacheLoads = new Map();

module.exports = {
    async cacheApiResponse(key, fetchFunction, ttl = 600) {
        const cached = this.get(key);
        if (cached !== undefined) {
            return cached;
        }

        if (pendingCacheLoads.has(key)) {
            return await pendingCacheLoads.get(key);
        }

        const loadPromise = (async () => {
            try {
                const result = await fetchFunction();
                this.set(key, result, ttl);
                return result;
            } catch (error) {
                logger.error('캐시 API 응답 실패', { key, error: error.message });
                throw error;
            } finally {
                pendingCacheLoads.delete(key);
            }
        })();

        pendingCacheLoads.set(key, loadPromise);
        return await loadPromise;
    }
};
