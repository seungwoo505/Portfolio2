const NodeCache = require('node-cache');
const logger = require('../../log');

const cache = new NodeCache({
    stdTTL: 600,
    checkperiod: 300,
    useClones: false,
    deleteOnExpire: true,
    maxKeys: 2000,
    forceString: false,
    enableLegacyCallbacks: false,
    arrayValueSize: 100,
    objectValueSize: 1000,
    promiseValueSize: 100,
});

cache.on('flush', () => {
    logger.info('캐시 전체 삭제');
});

module.exports = {
    cache,
    logger
};

export {};
