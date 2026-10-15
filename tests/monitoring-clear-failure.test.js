const test = require('node:test');
const assert = require('node:assert/strict');
const { stubRootModule, clearRootModules, createNoopLogger } = require('./helpers/module-loader');
const { requestJson } = require('./helpers/http-route-server');

stubRootModule(['log.ts'], createNoopLogger());
stubRootModule(['middleware', 'auth.ts'], { adminOnly: [(_req, _res, next) => next()] });
const CacheUtils = require('../utils/cache.ts');
const commands = require('../utils/redis-cache/commands.ts');

const loadCacheClearRoute = ({ connected, flushFails = false }) => {
    const redis = {
        isConnected: connected,
        ensureConnected: async () => connected,
        client: { flushAll: async () => { if (flushFails) throw new Error('Redis 명령 실패'); } },
        runWithClient: commands.runWithClient,
        flush: commands.flush
    };
    stubRootModule(['utils', 'redis-cache.ts'], redis);
    clearRootModules([['routes', 'monitoring', 'common.ts'], ['routes', 'monitoring', 'cache.ts']]);
    return require('../routes/monitoring/cache.ts');
};

for (const scenario of [
    { name: '연결되지 않은 Redis', connected: false },
    { name: '초기화 명령이 실패한 Redis', connected: true, flushFails: true }
]) {
    test(scenario.name + ' 초기화를 성공으로 응답하지 않는다', async () => {
        const result = await requestJson(loadCacheClearRoute(scenario), '/cache/clear', { method: 'POST', body: { type: 'redis' } });
        assert.equal(result.status, 503);
        assert.equal(result.body.success, false);
    });
}

test('전체 캐시 초기화에서 Redis가 실패하면 메모리 캐시를 유지한다', async () => {
    CacheUtils.set('monitoring-probe', { value: 'keep' });
    try {
        const result = await requestJson(loadCacheClearRoute({ connected: false }), '/cache/clear', { method: 'POST', body: { type: 'all' } });
        assert.equal(result.status, 503);
        assert.equal(result.body.success, false);
        assert.deepEqual(CacheUtils.get('monitoring-probe'), { value: 'keep' });
    } finally { CacheUtils.flush(); }
});

test('전체 캐시 초기화가 성공하면 메모리 캐시도 비운다', async () => {
    CacheUtils.set('monitoring-probe', { value: 'remove' });
    const result = await requestJson(loadCacheClearRoute({ connected: true }), '/cache/clear', { method: 'POST', body: { type: 'all' } });
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(CacheUtils.get('monitoring-probe'), undefined);
});

test('메모리 캐시만 초기화할 때는 Redis 연결 여부가 영향을 주지 않는다', async () => {
    CacheUtils.set('monitoring-probe', { value: 'remove' });
    const result = await requestJson(loadCacheClearRoute({ connected: false }), '/cache/clear', { method: 'POST', body: { type: 'memory' } });
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(CacheUtils.get('monitoring-probe'), undefined);
});
