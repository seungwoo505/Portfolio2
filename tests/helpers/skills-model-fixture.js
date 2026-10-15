const assert = require('node:assert/strict');
const { clearRootModules, resolveFromRoot, stubRootModule } = require('./module-loader');

const normalizeSql = query => query.replace(/\s+/g, ' ').trim().toLowerCase();
const modelFiles = ['skills.ts', 'skills/index.ts', 'skills/common.ts', 'skills/categories.ts',
    'skills/mutations.ts', 'skills/queries.ts', 'skills/write-lock.ts'];

// 실제 모델/라우트 아래의 DB 프로토콜만 대체한다. 두 풀 커넥션과 모델 인스턴스가
// 하나의 DB named lock 및 행 저장소를 공유하므로 프로세스 간 경합도 재현한다.
const createSkillsDatabase = ({ rows = [], gate = null, lockResult = 1, acquireFailure = false,
    releaseResult = 1, releaseFailure = false, failQuery = null,
    categories = [{ id: 1, name: '개발' }], beforeQuery = async () => {} } = {}) => {
    const storedRows = new Map(rows.map(row => [row.id, { ...row }]));
    const storedCategories = new Map(categories.map(row => [row.id, { ...row }]));
    const calls = [];
    const connections = [];
    const locks = new Map();
    const poolWaiters = [];
    let activeConnections = 0;
    let nextId = Math.max(0, ...storedRows.keys()) + 1;
    let writes = 0;
    let remainingFailure = failQuery;
    let gateCount = 0;
    let openGate;
    const gatePromise = new Promise(resolve => { openGate = resolve; });
    let notifyLockWaiter;
    const lockWaiter = new Promise(resolve => { notifyLockWaiter = resolve; });

    const snapshotGate = async (kind, snapshot, pooled) => {
        if (pooled && gate === kind && gateCount < 2) {
            gateCount += 1;
            if (gateCount === 2) openGate();
            await gatePromise;
        }
        return snapshot;
    };

    const releaseLocks = connection => {
        for (const lock of locks.values()) {
            if (lock.owner === connection) {
                lock.owner = null;
                lock.waiters.shift()?.();
            }
        }
    };

    const run = async (connection, query, params = [], pooled = false) => {
        const sql = normalizeSql(query);
        calls.push({ sql, params, connection, pooled });
        assert.equal(params.includes(undefined), false, 'mysql2 바인딩에 undefined가 없어야 한다');
        await beforeQuery({ sql, params, connection, pooled });

        if (sql.includes('get_lock(')) {
            if (lockResult !== 1) return [[{ acquired: lockResult }]];
            const key = params[0];
            if (!locks.has(key)) locks.set(key, { owner: null, waiters: [] });
            const lock = locks.get(key);
            if (lock.owner) {
                notifyLockWaiter();
                await new Promise(resolve => lock.waiters.push(resolve));
            }
            lock.owner = connection;
            if (acquireFailure) throw new Error('잠금 획득 응답 유실');
            return [[{ acquired: 1 }]];
        }
        if (sql.includes('release_lock(')) {
            if (releaseFailure) throw new Error('잠금 해제 응답 유실');
            if (releaseResult !== 1) return [[{ released: releaseResult }]];
            assert.equal(locks.get(params[0])?.owner, connection, '획득한 커넥션에서 해제해야 한다');
            releaseLocks(connection);
            return [[{ released: 1 }]];
        }
        if (remainingFailure && sql.includes(remainingFailure)) {
            remainingFailure = null;
            throw new Error('스킬 쿼리 실패');
        }
        if (sql.startsWith('select') && sql.includes('from skill_categories') && sql.includes('where id = ?')) {
            const row = storedCategories.get(Number(params[0]));
            return [row ? [{ ...row }] : []];
        }
        if (sql.startsWith('delete from skill_categories')) {
            const id = Number(params[0]);
            const deleted = storedCategories.delete(id);
            for (const row of storedRows.values()) {
                if (Number(row.category_id) === id) row.category_id = null;
            }
            return [{ affectedRows: deleted ? 1 : 0 }];
        }
        if (sql.startsWith('select') && sql.includes('from skills')) {
            if (sql.includes('where category_id = ?')) {
                return [[...storedRows.values()].filter(row => Number(row.category_id) === Number(params[0]))
                    .map(row => ({ id: row.id, name: row.name }))];
            }
            if (sql.includes('display_order = ?')) {
                const found = [...storedRows.values()].find(row => Number(row.display_order) === Number(params[0])
                    && Number(row.is_featured) === 1 && (params[1] == null || Number(row.id) !== Number(params[1])));
                const snapshot = found ? [{ ...found }] : [];
                return [await snapshotGate('conflict', snapshot, pooled)];
            }
            if (/where (?:s\.)?id = \?/.test(sql)) {
                const row = storedRows.get(Number(params[0]));
                const snapshot = row ? [{ ...row }] : [];
                return [await snapshotGate('existing', snapshot, pooled)];
            }
        }
        if (sql.startsWith('insert into skills')) {
            if (params[0] != null && !storedCategories.has(Number(params[0]))) {
                throw Object.assign(new Error('카테고리 외래 키가 없습니다.'), { code: 'ER_NO_REFERENCED_ROW_2' });
            }
            const fields = ['category_id', 'name', 'proficiency_level', 'years_of_experience',
                'icon', 'color', 'display_order', 'is_featured'];
            const id = nextId++;
            storedRows.set(id, { id, ...Object.fromEntries(fields.map((field, index) => [field, params[index]])) });
            writes += 1;
            return [{ insertId: id }];
        }
        if (sql.startsWith('update skills')) {
            const fields = [...sql.split(' where ')[0].matchAll(/(\w+) = \?/g)].map(match => match[1]);
            const row = storedRows.get(Number(params.at(-1)));
            const categoryIndex = fields.indexOf('category_id');
            if (categoryIndex >= 0 && params[categoryIndex] != null
                && !storedCategories.has(Number(params[categoryIndex]))) {
                throw Object.assign(new Error('카테고리 외래 키가 없습니다.'), { code: 'ER_NO_REFERENCED_ROW_2' });
            }
            if (row) fields.forEach((field, index) => { row[field] = params[index]; });
            writes += 1;
            return [{ affectedRows: row ? 1 : 0 }];
        }
        throw new Error(`예상하지 못한 스킬 SQL: ${sql}`);
    };

    const pool = {
        async getConnection() {
            if (activeConnections >= 2) await new Promise(resolve => poolWaiters.push(resolve));
            activeConnections += 1;
            const finish = () => { activeConnections -= 1; poolWaiters.shift()?.(); };
            const connection = {
                released: false,
                destroyed: false,
                execute: (query, params) => run(connection, query, params),
                release() {
                    assert.equal([...locks.values()].some(lock => lock.owner === this), false,
                        '잠긴 커넥션을 풀에 반환하면 안 된다');
                    this.released = true;
                    finish();
                },
                destroy() { this.destroyed = true; releaseLocks(this); finish(); }
            };
            connections.push(connection);
            return connection;
        },
        async execute(query, params) {
            const connection = await this.getConnection();
            try { return await run(connection, query, params, true); }
            finally { connection.release(); }
        }
    };

    const makeModel = () => {
        clearRootModules([
            ...modelFiles.map(file => ['models', ...file.split('/')]),
            ['models', 'db-utils.ts'], ['db.ts']
        ]);
        stubRootModule(['db.ts'], pool);
        stubRootModule(['models', 'db-utils.ts'], {
            executeQuery: async (query, params) => (await pool.execute(query, params))[0],
            executeQuerySingle: async (query, params) => (await pool.execute(query, params))[0][0] || null
        });
        return require(resolveFromRoot(['models', 'skills.ts']));
    };

    return {
        makeModel, rows: storedRows, categories: storedCategories, calls, connections, locks,
        waitForLockWaiter: () => lockWaiter,
        get writes() { return writes; },
        get gateCount() { return gateCount; }
    };
};

module.exports = { createSkillsDatabase };
