const createCacheStub = () => {
    const values = new Map();
    const invalidations = [];

    return {
        invalidations,
        get: (key) => values.get(key),
        set: (key, value) => {
            values.set(key, value);
            return true;
        },
        claim: (key, ttl) => {
            if (values.has(key)) {
                return false;
            }
            values.set(key, true, ttl);
            return true;
        },
        release: (key) => {
            values.delete(key);
            return true;
        },
        del: (key) => {
            invalidations.push(['del', key]);
            values.delete(key);
            return true;
        },
        delPattern: (pattern) => {
            invalidations.push(['delPattern', pattern]);
            return 0;
        },
        generateKey: (prefix, ...parts) => `${prefix}:${parts.join(':')}`,
        cacheApiResponse: async (_key, loader) => loader()
    };
};

module.exports = {
    createCacheStub
};
