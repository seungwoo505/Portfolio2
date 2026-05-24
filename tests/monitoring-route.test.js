const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const requestJson = async (router, path, { method = 'GET', body = undefined } = {}) => {
    const app = express();
    app.use(express.json({ strict: false }));
    app.use(router);

    const server = await new Promise((resolve) => {
        const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer));
    });

    try {
        const { port } = server.address();
        const hasBody = body !== undefined;
        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
            method,
            headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
            body: hasBody ? JSON.stringify(body) : undefined
        });
        return {
            status: response.status,
            body: await response.json()
        };
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
};

const loadMonitoringRoute = ({ cacheFlushes, redisFlushes }) => {
    clearRootModules([
        ['routes', 'monitoring.js'],
        ['utils', 'cache.js'],
        ['utils', 'redis-cache.js'],
        ['middleware', 'auth.js'],
        ['log.js']
    ]);

    stubRootModule(['log.js'], createNoopLogger());
    stubRootModule(['utils', 'cache.js'], {
        flush: () => {
            cacheFlushes.push('memory');
        },
        getStats: () => ({ keys: 0 })
    });
    stubRootModule(['utils', 'redis-cache.js'], {
        flush: async () => {
            redisFlushes.push('redis');
        },
        getStats: async () => ({ connected: false }),
        get: async () => null,
        isConnected: false
    });
    stubRootModule(['middleware', 'auth.js'], {
        adminOnly: [
            (req, _res, next) => {
                req.admin = { id: 1, role: 'admin' };
                next();
            }
        ]
    });

    return require(resolveFromRoot(['routes', 'monitoring.js']));
};

test('monitoring cache clear rejects missing cache type before flushing', async () => {
    const cacheFlushes = [];
    const redisFlushes = [];
    const router = loadMonitoringRoute({ cacheFlushes, redisFlushes });

    const { status, body } = await requestJson(router, '/cache/clear', {
        method: 'POST',
        body: {}
    });

    assert.equal(status, 400);
    assert.equal(body.message, '유효하지 않은 캐시 타입입니다. (memory, redis, all)');
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'error'), false);
    assert.deepEqual(cacheFlushes, []);
    assert.deepEqual(redisFlushes, []);
});

test('monitoring cache clear normalizes all cache type and flushes both stores', async () => {
    const cacheFlushes = [];
    const redisFlushes = [];
    const router = loadMonitoringRoute({ cacheFlushes, redisFlushes });

    const { status, body } = await requestJson(router, '/cache/clear', {
        method: 'POST',
        body: {
            type: ' ALL '
        }
    });

    assert.equal(status, 200);
    assert.equal(body.message, 'all 캐시가 성공적으로 초기화되었습니다.');
    assert.deepEqual(cacheFlushes, ['memory']);
    assert.deepEqual(redisFlushes, ['redis']);
});
