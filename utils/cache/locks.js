const { logger } = require('./store');

module.exports = {
    claim(key, ttl = 300) {
        if (this.get(key) !== undefined) {
            return false;
        }

        const isStored = this.set(key, true, ttl);
        if (!isStored) {
            logger.warn('캐시 선점 저장 실패', { key });
        }
        return true;
    },

    release(key) {
        try {
            return this.del(key);
        } catch (error) {
            logger.error('캐시 선점 해제 실패', { key, error: error.message });
            return false;
        }
    }
};
