const { RedisCacheConnection } = require('./connection');
const commandMethods = require('./commands');
const statsMethods = require('./stats');

class RedisCache extends RedisCacheConnection {}

Object.assign(
    RedisCache.prototype,
    commandMethods,
    statsMethods
);

module.exports = new RedisCache();

export {};
