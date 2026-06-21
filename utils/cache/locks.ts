const { logger } = require('./store');

type CacheLockContext = {
    get: (key: string) => unknown;
    set: (key: string, value: unknown, ttl?: number) => boolean;
    del: (key: string) => boolean;
};

const getErrorMessage = (error: unknown): string => (
    error instanceof Error ? error.message : String(error)
);

module.exports = {
    claim(this: CacheLockContext, key: string, ttl = 300): boolean {
        if (this.get(key) !== undefined) {
            return false;
        }

        const isStored = this.set(key, true, ttl);
        if (!isStored) {
            logger.warn('캐시 선점 저장 실패', { key });
        }
        return true;
    },

    release(this: CacheLockContext, key: string): boolean {
        try {
            return this.del(key);
        } catch (error) {
            logger.error('캐시 선점 해제 실패', { key, error: getErrorMessage(error) });
            return false;
        }
    }
};

export {};
