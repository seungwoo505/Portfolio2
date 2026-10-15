const assert = require('node:assert/strict');
const { rootDir, createNoopLogger, stubRootModule } = require('./module-loader');
const path = require('node:path');

const sqlText = query => query.replace(/\s+/g, ' ').trim().toLowerCase();

// 실제 모델과 DB 유틸리티를 실행한다. 외부 DB 대신 두 커넥션이 공유하는
// UNIQUE 제약, 트랜잭션의 미커밋 행 및 DB named lock만 상태로 재현한다.
const createAtomicModelFixture = ({ table, rows = [], barrier = false, insertFailure = null,
    lockResult = 1, acquireFailure = false, releaseFailure = false, releaseResult = 1, queryFailure = null } = {}) => {
    const stored = new Map(rows.map(row => [row.id, { ...row }]));
    const connections = [];
    const calls = [];
    const locks = new Map();
    let nextId = Math.max(0, ...stored.keys()) + 1;
    let barrierCount = 0;
    let openBarrier;
    const barrierReady = new Promise(resolve => { openBarrier = resolve; });

    const unlock = connection => {
        for (const lock of locks.values()) {
            if (lock.owner === connection) {
                lock.owner = null;
                lock.waiters.shift()?.();
            }
        }
    };

    const run = async (connection, query, params = []) => {
        const sql = sqlText(query);
        calls.push({ sql, params, connection });
        assert.equal(params.includes(undefined), false, 'SQL 바인딩에 undefined가 없어야 한다');
        if (queryFailure && sql.includes(queryFailure.match)) throw queryFailure.error;
        if (sql.includes('get_lock(')) {
            if (lockResult !== 1) return [[{ acquired: lockResult }]];
            const key = params[0];
            if (!locks.has(key)) locks.set(key, { owner: null, waiters: [] });
            const lock = locks.get(key);
            if (lock.owner) await new Promise(resolve => lock.waiters.push(resolve));
            lock.owner = connection;
            if (acquireFailure) throw new Error('잠금 획득 응답 유실');
            return [[{ acquired: 1 }]];
        }
        if (sql.includes('release_lock(')) {
            if (releaseFailure) throw new Error('잠금 해제 응답 유실');
            if (releaseResult !== 1) return [[{ released: releaseResult }]];
            assert.equal(locks.get(params[0])?.owner, connection);
            unlock(connection);
            return [[{ released: 1 }]];
        }
        if (sql.startsWith('select') && sql.includes(`from ${table}`)) {
            const visible = [...stored.values(), ...(connection.pending || [])];
            let result;
            if (sql.includes('where slug = ?')) {
                result = visible.filter(row => row.slug === params[0] && (!sql.includes('id != ?') || row.id !== params[1]));
            } else if (sql.includes('where id = ?')) {
                result = visible.filter(row => row.id === Number(params[0]));
            } else {
                result = visible.sort((left, right) => right.id - left.id).slice(0, 1);
            }
            const snapshot = result.map(row => ({ ...row }));
            // 잠금 도입 전 두 빈 SELECT가 모두 끝난 뒤 INSERT하도록 한다.
            // named lock을 보유한 SELECT는 직렬화되므로 이 장벽을 통과할 필요가 없다.
            const locked = [...locks.values()].some(lock => lock.owner === connection);
            if (barrier && !locked && barrierCount < 2 && (sql.includes('where slug = ?') || sql.startsWith('select id'))) {
                barrierCount += 1;
                if (barrierCount === 2) openBarrier();
                await barrierReady;
            }
            return [snapshot];
        }
        if (sql.startsWith(`insert into ${table} `)) {
            if (insertFailure) throw insertFailure;
            const fields = sql.match(/\(([^)]+)\)/)[1].split(',').map(field => field.trim());
            const row = { id: nextId++ };
            fields.slice(0, params.length).forEach((field, index) => { row[field] = params[index]; });
            if (row.slug !== undefined) {
                for (const other of connections) {
                    if (other !== connection && other.pending?.some(item => item.slug === row.slug)) await other.finished;
                }
                if ([...stored.values(), ...(connection.pending || [])].some(item => item.slug === row.slug)) {
                    throw Object.assign(new Error(`Duplicate entry '${row.slug}' for key '${table}.slug'`), { code: 'ER_DUP_ENTRY' });
                }
            }
            if (connection.pending) connection.pending.push(row);
            else stored.set(row.id, row);
            return [{ insertId: row.id, affectedRows: 1 }];
        }
        if (sql.startsWith(`update ${table} set `)) {
            const row = stored.get(Number(params.at(-1)));
            const fields = [...sql.split(' where ')[0].matchAll(/(\w+) = \?/g)].map(match => match[1]);
            if (row) fields.forEach((field, index) => { row[field] = params[index]; });
            return [{ affectedRows: row ? 1 : 0 }];
        }
        if (sql.startsWith('delete from tag_usage where ')) return [{ affectedRows: 0 }];
        if (sql.startsWith('select')) return [[]];
        throw new Error(`예상하지 못한 SQL: ${sql}`);
    };

    const pool = {
        async getConnection() {
            const connection = {
                pending: null, commits: 0, rollbacks: 0, released: false, destroyed: false,
                execute: (query, params) => run(connection, query, params),
                async beginTransaction() {
                    this.pending = [];
                    this.finished = new Promise(resolve => { this.finish = resolve; });
                },
                async commit() {
                    this.pending.forEach(row => stored.set(row.id, row));
                    this.pending = null;
                    this.commits += 1;
                    this.finish();
                },
                async rollback() { this.pending = null; this.rollbacks += 1; this.finish(); },
                release() {
                    assert.equal([...locks.values()].some(lock => lock.owner === this), false, '잠금 보유 연결을 반환하면 안 된다');
                    this.released = true;
                },
                destroy() { this.destroyed = true; unlock(this); }
            };
            connections.push(connection);
            return connection;
        },
        async execute(query, params) {
            const connection = await this.getConnection();
            try { return await connection.execute(query, params); }
            finally { connection.release(); }
        }
    };

    const loadModel = family => {
        for (const key of Object.keys(require.cache)) {
            if (key.startsWith(path.join(rootDir, 'models') + path.sep)
                || key === require.resolve(path.join(rootDir, 'db.ts'))
                || key === require.resolve(path.join(rootDir, 'utils', 'slug.ts'))) delete require.cache[key];
        }
        stubRootModule(['db.ts'], pool);
        stubRootModule(['log.ts'], createNoopLogger());
        stubRootModule(['utils', 'cache.ts'], {
            generateKey: (...parts) => parts.join(':'),
            cacheApiResponse: async (_key, load) => load(),
            invalidateResources: () => 0,
            delPattern: () => 0
        });
        return require(path.join(rootDir, 'models', `${family}.ts`));
    };
    return { loadModel, rows: stored, calls, connections, locks, get barrierCount() { return barrierCount; } };
};

module.exports = { createAtomicModelFixture };
