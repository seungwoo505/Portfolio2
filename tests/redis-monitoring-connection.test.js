const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const { setImmediate: nextTurn } = require('node:timers/promises');
const { createRedisMonitoringFixture, deferred } = require('./helpers/redis-monitoring-fixture');
const { startRouterServer, readJsonResponse, postJson } = require('./helpers/http-route-server');

test('첫 Redis 연결 중인 모든 호출은 같은 연결 성공을 기다린다', async () => {
    const gate = deferred();
    const fixture = createRedisMonitoringFixture({ connect: () => gate.promise });
    const first = fixture.redisCache.ensureConnected();
    let secondSettled = false;
    const second = fixture.redisCache.ensureConnected().then((result) => {
        secondSettled = true;
        return result;
    });
    try {
        await nextTurn();
        assert.equal(secondSettled, false, '연결 진행 중에는 재시도 제한으로 false를 반환하면 안 된다');
        gate.resolve();
        assert.deepEqual(await Promise.all([first, second]), [true, true]);
        assert.equal(fixture.calls.connect, 1);
        assert.equal(fixture.redisCache.connectPromise, null);
    } finally {
        gate.resolve();
        await Promise.allSettled([first, second]);
        await fixture.close();
    }
});

test('첫 Redis 연결 실패는 모든 대기 호출에 전달되고 제한 시간이 지난 뒤 다시 연결한다', async (t) => {
    const gate = deferred();
    const startedAt = 1700000000000;
    let now = startedAt;
    t.mock.method(Date, 'now', () => now);
    const fixture = createRedisMonitoringFixture({
        connect: (attempt) => attempt === 1 ? gate.promise : Promise.resolve()
    });
    const first = fixture.redisCache.ensureConnected();
    let secondSettled = false;
    const second = fixture.redisCache.ensureConnected().then((result) => {
        secondSettled = true;
        return result;
    });
    try {
        await nextTurn();
        assert.equal(secondSettled, false, '후속 호출도 실패가 결정될 때까지 기다려야 한다');
        gate.reject(new Error('Redis 연결 실패'));
        assert.deepEqual(await Promise.all([first, second]), [false, false]);
        assert.equal(fixture.redisCache.isConnected, false);
        assert.equal(fixture.redisCache.client, null);
        assert.equal(fixture.redisCache.connectPromise, null);
        assert.equal(await fixture.redisCache.ensureConnected(), false);
        assert.equal(fixture.calls.connect, 1);

        now = startedAt + fixture.redisCache.retryDelayMs + 1;
        assert.equal(await fixture.redisCache.ensureConnected(), true);
        assert.equal(fixture.calls.connect, 2);
        assert.equal(fixture.redisCache.isConnected, true);
        assert.equal(fixture.redisCache.client.isOpen, true);
        assert.equal(fixture.redisCache.connectPromise, null);
    } finally {
        gate.resolve();
        await Promise.allSettled([first, second]);
        await fixture.close();
    }
});

test('대시보드가 시작한 Redis 연결 중 캐시 초기화 요청도 기다린 뒤 성공한다', async () => {
    const connecting = deferred();
    const gate = deferred();
    const clearEntered = deferred();
    const fixture = createRedisMonitoringFixture({ connect: () => {
        connecting.resolve();
        return gate.promise;
    } });
    let clearFinished = false;
    const router = express.Router();
    router.use((req, res, next) => {
        if (req.path === '/cache/clear') {
            res.on('finish', () => { clearFinished = true; });
            clearEntered.resolve();
        }
        next();
    });
    router.use(fixture.router);
    const server = await startRouterServer(router, { json: true });
    const dashboard = fetch(`${server.baseUrl}/dashboard`).then(readJsonResponse);
    let clear;
    try {
        await connecting.promise;
        clear = postJson(server.baseUrl, '/cache/clear', { type: 'redis' });
        await clearEntered.promise;
        await nextTurn();
        assert.equal(clearFinished, false, '연결이 끝나기 전에 초기화 요청을 503으로 종료하면 안 된다');
        assert.equal(fixture.calls.flush, 0);

        gate.resolve();
        const [dashboardResult, clearResult] = await Promise.all([dashboard, clear]);
        assert.equal(dashboardResult.status, 200);
        assert.equal(dashboardResult.body.data.cache.redis.connected, true);
        assert.equal(clearResult.status, 200);
        assert.equal(clearResult.body.success, true);
        assert.equal(fixture.calls.connect, 1);
        assert.equal(fixture.calls.flush, 1);
    } finally {
        gate.resolve();
        await Promise.allSettled([dashboard, clear]);
        await server.close();
        await fixture.close();
    }
});
