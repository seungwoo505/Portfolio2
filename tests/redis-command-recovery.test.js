const test = require('node:test');
const assert = require('node:assert/strict');
const { createRedisMonitoringFixture } = require('./helpers/redis-monitoring-fixture');
const { requestJson } = require('./helpers/http-route-server');

test('Redis 명령 NOPERM 이후 열린 연결을 재사용해 다음 상태 요청이 성공한다', async (t) => {
    let now = 1700000000000;
    t.mock.method(Date, 'now', () => now);
    const fixture = createRedisMonitoringFixture({
        ping: async (attempt) => {
            if (attempt === 1) throw new Error('NOPERM user cannot run PING');
            return 'PONG';
        }
    });
    try {
        const first = await requestJson(fixture.router, '/metrics');
        assert.equal(first.status, 200);
        assert.equal(first.body.data.redis.connected, false);
        now += fixture.redisCache.retryDelayMs + 1;
        const recovered = await requestJson(fixture.router, '/metrics');
        assert.equal(recovered.status, 200);
        assert.equal(recovered.body.data.redis.connected, true);
        assert.equal(fixture.calls.connect, 1, '열린 클라이언트를 다시 connect 하면 안 된다');
        assert.equal(fixture.clients.length, 1);
    } finally {
        await fixture.close();
    }
    assert.equal(fixture.clients.filter((client) => client.isOpen).length, 0);
});

test('Redis 데이터 역직렬화 실패 이후 다른 키는 연결 제한 없이 조회한다', async () => {
    const fixture = createRedisMonitoringFixture({ values: new Map([
        ['invalid', '{'], ['valid', '{"ok":true}']
    ]) });
    try {
        assert.equal(await fixture.redisCache.get('invalid'), null);
        assert.deepEqual(await fixture.redisCache.get('valid'), { ok: true });
        assert.equal(fixture.calls.connect, 1);
    } finally {
        await fixture.close();
        assert.equal(fixture.clients.filter((client) => client.isOpen).length, 0);
    }
});

test('Redis 연결 플래그가 내려가도 열린 클라이언트를 재사용한다', async () => {
    const fixture = createRedisMonitoringFixture();
    try {
        assert.equal(await fixture.redisCache.ensureConnected(), true);
        fixture.redisCache.isConnected = false;
        assert.equal(await fixture.redisCache.ping(), true);
        assert.equal(fixture.calls.connect, 1);
    } finally {
        await fixture.close();
        assert.equal(fixture.clients.filter((client) => client.isOpen).length, 0);
    }
});

test('Redis 명령 중 소켓이 닫히면 실패 제한 시간을 지킨 뒤 재연결한다', async (t) => {
    let now = 1700000000000;
    t.mock.method(Date, 'now', () => now);
    const fixture = createRedisMonitoringFixture({
        ping: async (attempt, client) => {
            if (attempt === 1) {
                client.isOpen = false;
                throw new Error('Socket closed unexpectedly');
            }
            return 'PONG';
        }
    });
    try {
        assert.equal(await fixture.redisCache.ping(), false);
        assert.equal(await fixture.redisCache.ping(), false);
        assert.equal(fixture.calls.connect, 1);
        now += fixture.redisCache.retryDelayMs + 1;
        assert.equal(await fixture.redisCache.ping(), true);
        assert.equal(fixture.calls.connect, 2);
    } finally {
        await fixture.close();
        assert.equal(fixture.clients.filter((client) => client.isOpen).length, 0);
    }
});

test('Redis 종료는 QUIT 명령 권한 없이 열린 클라이언트를 정리한다', async () => {
    const fixture = createRedisMonitoringFixture({
        quit: async () => { throw new Error('NOPERM user cannot run QUIT'); }
    });
    await fixture.redisCache.ensureConnected();
    try {
        await fixture.redisCache.disconnect();
        assert.equal(fixture.clients.filter((client) => client.isOpen || client.isReady).length, 0);
        assert.equal(fixture.redisCache.client, null);
        assert.equal(fixture.redisCache.isConnected, false);
    } finally {
        for (const client of fixture.clients) if (client.isOpen) client.destroy();
        await fixture.close();
    }
});
