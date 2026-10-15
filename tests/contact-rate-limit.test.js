const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { clearRootModules, stubRootModule } = require('./helpers/module-loader');
const { loadPublicRoute } = require('./helpers/public-route-loader');
const { createCacheStub } = require('./helpers/cache-stub');
const { requestJson, startRouterServer, postJson } = require('./helpers/http-route-server');

// 별도 모델 인스턴스와 커넥션들이 하나의 DB 서버 잠금 및 저장소를 공유한다.
const createDatabase = ({ recent = 2, lockResult = 1, failInsert = false, failRelease = false } = {}) => {
    const counts = new Map([['127.0.0.1', recent]]);
    const locks = new Map();
    const calls = [];
    const connections = [];
    const inserts = [];
    let shouldFailInsert = failInsert;
    const run = async (connection, query, params = []) => {
        const sql = query.replace(/\s+/g, ' ').trim().toLowerCase();
        calls.push({ sql, params, connection });
        assert.equal(params.includes(undefined), false, 'mysql2는 undefined 바인딩을 허용하지 않는다');
        if (sql.includes('get_lock(')) {
            if (lockResult !== 1) return [[{ acquired: lockResult }]];
            const name = params[0];
            let lock = locks.get(name);
            if (!lock) { lock = { owner: null, waiters: [] }; locks.set(name, lock); }
            if (lock.owner) await new Promise(resolve => lock.waiters.push(resolve));
            lock.owner = connection;
            return [[{ acquired: 1 }]];
        }
        if (sql.includes('release_lock(')) {
            if (failRelease) throw new Error('잠금 해제 실패');
            const lock = locks.get(params[0]);
            assert.equal(lock.owner, connection);
            lock.owner = null;
            lock.waiters.shift()?.();
            return [[{ released: 1 }]];
        }
        if (sql.startsWith('select count(*)')) {
            const total = counts.get(params[0]) || 0;
            await new Promise(resolve => setTimeout(resolve, 25));
            return [[{ total }]];
        }
        if (sql.startsWith('insert into contact_messages')) {
            if (shouldFailInsert) { shouldFailInsert = false; throw new Error('저장 실패'); }
            inserts.push(params);
            counts.set(params[4], (counts.get(params[4]) || 0) + 1);
            return [{ insertId: inserts.length }];
        }
        throw new Error(`예상하지 못한 쿼리: ${sql}`);
    };
    const pool = { getConnection: async () => {
        const connection = {
            released: false, destroyed: false,
            execute: (query, params) => run(connection, query, params),
            release() { this.released = true; },
            destroy() {
                this.destroyed = true;
                for (const lock of locks.values()) {
                    if (lock.owner === this) { lock.owner = null; lock.waiters.shift()?.(); }
                }
            }
        };
        connections.push(connection);
        return connection;
    } };
    const makeModel = () => {
        clearRootModules([
            ...['contact-messages.ts', 'contact-messages/index.ts', 'contact-messages/queries.ts',
                'contact-messages/mutations.ts', 'contact-messages/rate-limit.ts', 'contact-messages/stats.ts']
                .map(file => ['models', ...file.split('/')]),
            ['models', 'db-utils.ts'], ['db.ts']
        ]);
        stubRootModule(['db.ts'], pool);
        stubRootModule(['models', 'db-utils.ts'], {
            executeQuery: async (query, params) => (await run(null, query, params))[0],
            executeQuerySingle: async (query, params) => (await run(null, query, params))[0][0]
        });
        return require('../models/contact-messages.ts');
    };
    return { makeModel, counts, calls, connections, inserts, locks };
};
const body = { name: '방문자', email: 'test@example.com', message: '문의 내용입니다.' };
const makeRouter = database => loadPublicRoute({ ContactMessages: database.makeModel(), CacheUtils: createCacheStub() });

test('서로 다른 서버 인스턴스의 동시 문의도 IP 한도를 초과하지 않는다', { timeout: 5000 }, async () => {
    const database = createDatabase();
    const firstServer = await startRouterServer(makeRouter(database), { json: true });
    const secondServer = await startRouterServer(makeRouter(database), { json: true });
    try {
        const results = await Promise.all([
            postJson(firstServer.baseUrl, '/contact', { ...body, message: '서로 다른 문의 1' }),
            postJson(secondServer.baseUrl, '/contact', { ...body, message: '서로 다른 문의 2' })
        ]);
        assert.deepEqual(results.map(result => result.status).sort(), [201, 429]);
        assert.equal(database.counts.get('127.0.0.1'), 3);
        assert.equal(database.inserts.length, 1);
        assert.equal(database.connections.every(connection => connection.released), true);
        assert.equal([...database.locks.values()].every(lock => !lock.owner), true);
    } finally {
        await firstServer.close();
        await secondServer.close();
    }
});

test('User-Agent 없는 문의도 SQL NULL로 저장하고 201을 반환한다', async () => {
    const database = createDatabase({ recent: 0 });
    const server = await startRouterServer(makeRouter(database), { json: true });
    try {
        const result = await new Promise((resolve, reject) => {
            const request = http.request(`${server.baseUrl}/contact`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }
            }, response => {
                response.resume();
                response.on('end', () => resolve(response.statusCode));
            });
            request.on('error', reject);
            request.end(JSON.stringify(body));
        });
        assert.equal(result, 201);
        assert.equal(database.inserts[0][5], null);
    } finally { await server.close(); }
});

test('저장 실패 후 잠금과 중복 접수 예약을 해제하여 다시 접수할 수 있다', async () => {
    const database = createDatabase({ recent: 0, failInsert: true });
    const router = makeRouter(database);
    assert.equal((await requestJson(router, '/contact', { method: 'POST', body })).status, 500);
    assert.equal((await requestJson(router, '/contact', { method: 'POST', body })).status, 201);
    assert.equal(database.counts.get('127.0.0.1'), 1);
    assert.equal(database.calls.filter(call => call.sql.includes('release_lock(')).length, 2);
    assert.equal(database.connections.every(connection => connection.released), true);
});

for (const lockResult of [0, '0']) {
    test(`잠금 대기 결과가 ${typeof lockResult} 0이면 저장하지 않고 429를 반환한다`, async () => {
        const database = createDatabase({ lockResult });
        const result = await requestJson(makeRouter(database), '/contact', { method: 'POST', body });
        assert.equal(result.status, 429);
        assert.equal(database.inserts.length, 0);
        assert.equal(database.connections[0].released, true);
    });
}

test('DB 잠금 오류는 500이며 저장하지 않는다', async () => {
    const database = createDatabase({ lockResult: null });
    const result = await requestJson(makeRouter(database), '/contact', { method: 'POST', body });
    assert.equal(result.status, 500);
    assert.equal(database.inserts.length, 0);
});

test('잠금 해제에 실패한 커넥션은 풀에 돌려주지 않고 폐기한다', async () => {
    const database = createDatabase({ recent: 0, failRelease: true });
    const result = await requestJson(makeRouter(database), '/contact', { method: 'POST', body });
    assert.equal(result.status, 201);
    assert.equal(database.connections[0].destroyed, true);
    assert.equal(database.connections[0].released, false);
});
