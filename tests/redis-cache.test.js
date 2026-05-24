const test = require('node:test');
const assert = require('node:assert/strict');

const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const createRedisCacheFixture = ({ connectError = null, infoError = null } = {}) => {
    clearRootModules([
        ['utils', 'redis-cache.js'],
        ['log.js']
    ]);

    const redisModulePath = require.resolve('redis', {
        paths: [resolveFromRoot('package.json')]
    });
    delete require.cache[redisModulePath];

    const calls = {
        createClient: 0,
        connect: 0,
        config: null,
        events: {}
    };

    const client = {
        isOpen: false,
        on: (event, handler) => {
            calls.events[event] = handler;
        },
        connect: async () => {
            calls.connect += 1;
            if (connectError) {
                throw connectError;
            }
            client.isOpen = true;
            calls.events.connect?.();
        },
        get: async () => JSON.stringify({ ok: true }),
        setEx: async () => 'OK',
        del: async () => 1,
        keys: async () => ['cache:a'],
        flushAll: async () => 'OK',
        info: async () => {
            if (infoError) {
                throw infoError;
            }
            return 'used_memory:1';
        },
        dbSize: async () => 1,
        quit: async () => {
            client.isOpen = false;
        }
    };

    require.cache[redisModulePath] = {
        id: redisModulePath,
        filename: redisModulePath,
        loaded: true,
        exports: {
            createClient: (config) => {
                calls.createClient += 1;
                calls.config = config;
                return client;
            }
        }
    };

    stubRootModule(['log.js'], createNoopLogger());

    return {
        redisCache: require(resolveFromRoot(['utils', 'redis-cache.js'])),
        calls
    };
};

test('RedisCache does not connect at import time and lazily connects on use', async () => {
    const fixture = createRedisCacheFixture();

    assert.equal(fixture.calls.createClient, 0);

    const value = await fixture.redisCache.get('cache:key');

    assert.deepEqual(value, { ok: true });
    assert.equal(fixture.calls.createClient, 1);
    assert.equal(fixture.calls.connect, 1);
});

test('RedisCache uses redis v5 socket reconnectStrategy', async () => {
    const fixture = createRedisCacheFixture();

    await fixture.redisCache.set('cache:key', { ok: true });

    assert.equal(typeof fixture.calls.config.socket.reconnectStrategy, 'function');
    assert.equal(fixture.calls.config.retry_strategy, undefined);
});

test('RedisCache returns fallback when lazy connection fails', async () => {
    const fixture = createRedisCacheFixture({
        connectError: new Error('redis unavailable')
    });

    const value = await fixture.redisCache.get('cache:key');

    assert.equal(value, null);
    assert.equal(fixture.calls.createClient, 1);
    assert.equal(fixture.calls.connect, 1);
});

test('RedisCache retry delay falls back for invalid environment values', () => {
    const previousValue = process.env.REDIS_RETRY_DELAY_MS;
    process.env.REDIS_RETRY_DELAY_MS = 'not-a-delay';

    try {
        const fixture = createRedisCacheFixture();

        assert.equal(fixture.redisCache.retryDelayMs, 30000);
    } finally {
        if (previousValue === undefined) {
            delete process.env.REDIS_RETRY_DELAY_MS;
        } else {
            process.env.REDIS_RETRY_DELAY_MS = previousValue;
        }
        clearRootModules([['utils', 'redis-cache.js']]);
    }
});

test('RedisCache getStats hides internal Redis errors', async () => {
    const fixture = createRedisCacheFixture({
        infoError: new Error('ERR unknown command info')
    });

    const stats = await fixture.redisCache.getStats();

    assert.deepEqual(stats, { connected: false });
    assert.equal(Object.prototype.hasOwnProperty.call(stats, 'error'), false);
});
