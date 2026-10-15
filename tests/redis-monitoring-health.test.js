const test = require('node:test');
const assert = require('node:assert/strict');
const { createRedisMonitoringFixture, deferred } = require('./helpers/redis-monitoring-fixture');
const { startRouterServer, requestJson, readJsonResponse } = require('./helpers/http-route-server');

for (const { name, value } of [
    { name: '일반 문자열', value: 'hello' },
    { name: '손상된 JSON', value: '{' },
    { name: '정상 JSON', value: '{"ok":true}' },
    { name: '없는 키', value: undefined }
]) {
    test(`Redis 상태 검사는 test 키가 ${name}이어도 PONG 응답으로 연결을 판정한다`, async () => {
        const values = new Map(value === undefined ? [] : [['test', value]]);
        const fixture = createRedisMonitoringFixture({ values });
        try {
            const result = await requestJson(fixture.router, '/metrics');
            assert.equal(result.status, 200);
            assert.equal(result.body.data.redis.connected, true);
            assert.equal(fixture.redisCache.isConnected, true);
            assert.equal(fixture.redisCache.client.isOpen, true);
            assert.equal(fixture.calls.ping, 1);
            assert.deepEqual(fixture.calls.get, []);
            assert.equal(values.get('test'), value);
        } finally { await fixture.close(); }
    });
}

for (const scenario of [
    { name: 'PONG가 아닌 응답', ping: async () => 'unexpected' },
    { name: 'PING 명령 실패', ping: async () => { throw new Error('Redis PING 실패'); } },
    { name: '연결 실패', connect: async () => { throw new Error('Redis 연결 실패'); } }
]) {
    test(`Redis 상태 검사는 ${scenario.name}이면 연결 실패를 응답한다`, async () => {
        const fixture = createRedisMonitoringFixture(scenario);
        try {
            const result = await requestJson(fixture.router, '/metrics');
            assert.equal(result.status, 200);
            assert.equal(result.body.data.redis.connected, false);
        } finally { await fixture.close(); }
    });
}

test('Redis 상태 검사는 연결 플래그가 true여도 PING 응답이 올 때까지 기다린다', async () => {
    const pingStarted = deferred();
    const gate = deferred();
    const fixture = createRedisMonitoringFixture({ ping: () => {
        pingStarted.resolve('ping');
        return gate.promise;
    } });
    const server = await startRouterServer(fixture.router);
    await fixture.redisCache.ensureConnected();
    const response = fetch(`${server.baseUrl}/metrics`).then(readJsonResponse);
    try {
        const first = await Promise.race([pingStarted.promise, response.then(() => 'response')]);
        assert.equal(first, 'ping', '연결 플래그만 읽고 상태 응답을 끝내면 안 된다');
        gate.resolve('PONG');
        const result = await response;
        assert.equal(result.status, 200);
        assert.equal(result.body.data.redis.connected, true);
    } finally {
        gate.resolve('PONG');
        await Promise.allSettled([response]);
        await server.close();
        await fixture.close();
    }
});

test('Redis 데이터 조회는 기존 JSON 역직렬화와 잘못된 JSON의 null 반환을 유지한다', async () => {
    const fixture = createRedisMonitoringFixture({ values: new Map([
        ['object', '{"name":"cache","count":2}'],
        ['text', '"hello"'],
        ['invalid', 'hello']
    ]) });
    try {
        assert.deepEqual(await fixture.redisCache.get('object'), { name: 'cache', count: 2 });
        assert.equal(await fixture.redisCache.get('text'), 'hello');
        assert.equal(await fixture.redisCache.get('missing'), null);
        assert.equal(await fixture.redisCache.get('invalid'), null);
    } finally { await fixture.close(); }
});
