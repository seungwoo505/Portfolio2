const logger = require('../../log');

const runWithClient = async function (operation, fallback, errorMessage, meta = {}) {
    if (!await this.ensureConnected()) {
        return fallback;
    }

    try {
        return await operation(this.client);
    } catch (error) {
        logger.error(errorMessage, { ...meta, error: error.message });
        this.isConnected = false;
        return fallback;
    }
};

const get = async function (key) {
    return await this.runWithClient(async () => {
        const value = await this.client.get(key);
        return value ? JSON.parse(value) : null;
    }, null, 'Redis GET 오류', { key });
};

const set = async function (key, value, ttl = 3600) {
    return await this.runWithClient(async () => {
        const serialized = JSON.stringify(value);
        await this.client.setEx(key, ttl, serialized);
        return true;
    }, false, 'Redis SET 오류', { key });
};

const del = async function (key) {
    return await this.runWithClient(async () => {
        await this.client.del(key);
        return true;
    }, false, 'Redis DEL 오류', { key });
};

const delPattern = async function (pattern) {
    return await this.runWithClient(async () => {
        const keys = await this.client.keys(pattern);
        if (keys.length > 0) {
            await this.client.del(keys);
        }
        return true;
    }, false, 'Redis DEL PATTERN 오류', { pattern });
};

const flush = async function () {
    return await this.runWithClient(async () => {
        await this.client.flushAll();
        return true;
    }, false, 'Redis FLUSH 오류');
};

module.exports = {
    del,
    delPattern,
    flush,
    get,
    runWithClient,
    set
};
