const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const { getRetryAfterSeconds } = require('../utils/rate-limit');
const {
    clearRootModules,
    createNoopLogger,
    stubRootModule
} = require('./helpers/module-loader');

const loadRateLimitersWithEnv = (env) => {
    const previousEnv = {};
    for (const [key, value] of Object.entries(env)) {
        previousEnv[key] = process.env[key];
        process.env[key] = String(value);
    }

    clearRootModules([
        ['middleware', 'rate-limiters.ts'],
        ['log.ts']
    ]);
    stubRootModule(['log.ts'], createNoopLogger());
    const limiters = require('../middleware/rate-limiters');

    return {
        limiters,
        restore: () => {
            clearRootModules([
                ['middleware', 'rate-limiters.ts'],
                ['log.ts']
            ]);
            for (const key of Object.keys(env)) {
                if (previousEnv[key] === undefined) {
                    delete process.env[key];
                } else {
                    process.env[key] = previousEnv[key];
                }
            }
        }
    };
};

const withLimiterServer = async (limiter, callback) => {
    const app = express();
    app.use(limiter);
    app.get('/ok', (_req, res) => {
        res.json({ success: true });
    });

    const server = await new Promise((resolve) => {
        const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer));
    });

    try {
        const baseUrl = `http://127.0.0.1:${server.address().port}`;
        return await callback(baseUrl);
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
};

const getJson = async (baseUrl) => {
    const response = await fetch(`${baseUrl}/ok`);
    return {
        status: response.status,
        body: await response.json()
    };
};

test('getRetryAfterSeconds returns remaining seconds for Date resetTime', () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);
    const resetTime = new Date(now + 42_500);

    assert.equal(getRetryAfterSeconds({ resetTime }, 60, now), 43);
});

test('getRetryAfterSeconds accepts epoch milliseconds and seconds', () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);

    assert.equal(getRetryAfterSeconds({ resetTime: now + 10_000 }, 60, now), 10);
    assert.equal(getRetryAfterSeconds({ resetTime: (now + 20_000) / 1000 }, 60, now), 20);
});

test('getRetryAfterSeconds clamps expired or missing resetTime to a positive fallback', () => {
    const now = Date.UTC(2026, 0, 1, 0, 0, 0);

    assert.equal(getRetryAfterSeconds({ resetTime: new Date(now - 1000) }, 60, now), 1);
    assert.equal(getRetryAfterSeconds({}, 900, now), 900);
    assert.equal(getRetryAfterSeconds({}, 0, now), 1);
});

test('public, AI, and monitoring limiters count successful requests', async () => {
    const { limiters, restore } = loadRateLimitersWithEnv({
        PUBLIC_RATE_LIMIT_MAX: 1,
        AI_RATE_LIMIT_MAX: 1,
        MONITORING_RATE_LIMIT_MAX: 1
    });

    try {
        for (const limiter of [
            limiters.publicReadLimiter,
            limiters.aiLimiter,
            limiters.monitoringLimiter
        ]) {
            await withLimiterServer(limiter, async (baseUrl) => {
                const first = await getJson(baseUrl);
                const second = await getJson(baseUrl);

                assert.equal(first.status, 200);
                assert.equal(first.body.success, true);
                assert.equal(second.status, 429);
                assert.equal(second.body.success, false);
                assert.equal(typeof second.body.message, 'string');
                assert.equal(second.body.message.length > 0, true);
                assert.equal(typeof second.body.retryAfter, 'number');
            });
        }
    } finally {
        restore();
    }
});

test('login limiter does not count successful requests', async () => {
    const { limiters, restore } = loadRateLimitersWithEnv({});

    try {
        await withLimiterServer(limiters.loginLimiter, async (baseUrl) => {
            const responses = [];

            for (let index = 0; index < 6; index += 1) {
                responses.push(await getJson(baseUrl));
            }

            assert.deepEqual(
                responses.map((response) => response.status),
                [200, 200, 200, 200, 200, 200]
            );
        });
    } finally {
        restore();
    }
});
