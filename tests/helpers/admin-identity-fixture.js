const bcrypt = require('bcryptjs');
const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./module-loader');

const normalizeSql = query => query.replace(/\s+/g, ' ').trim().toLowerCase();
// 실제 스키마의 unicode_ci 비교를 흉내 내는 DB 경계 대역이다.
const collationKey = value => String(value).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trimEnd();
const equal = (left, right) => collationKey(left) === collationKey(right);

const createAdminIdentityFixture = async ({ hooks = {} } = {}) => {
    clearRootModules([
        ['models', 'admin-users.ts'], ['models', 'admin-users', 'index.ts'],
        ['models', 'admin-users', 'common.ts'], ['models', 'admin-users', 'auth.ts'],
        ['models', 'admin-users', 'tokens.ts'], ['models', 'admin-users', 'sessions.ts'],
        ['models', 'admin-users', 'users.ts'], ['models', 'admin-users', 'permissions.ts'],
        ['models', 'db-utils.ts'], ['models', 'db-utils', 'transaction.ts'],
        ['db.ts'], ['log.ts']
    ]);
    const passwordHash = await bcrypt.hash('correct-password', 4);
    const users = [
        { id: 1, username: 'alice', email: 'shared@example.com', password_hash: passwordHash, is_active: 1 },
        { id: 2, username: 'bob', email: 'bob@example.com', password_hash: passwordHash, is_active: 1 }
    ];
    const calls = [];
    let nextConnectionId = 0;
    let nextUserId = 3;
    const lockOwners = new Map();
    const waiters = new Map();
    const releaseLock = (context, name) => {
        for (const [key, owner] of lockOwners) {
            if (owner !== context || (name && key !== name)) continue;
            lockOwners.delete(key);
            (waiters.get(key) || []).splice(0).forEach(resolve => resolve());
        }
    };
    const execute = async (query, params = [], context = null) => {
        if (params.includes(undefined)) throw new TypeError('undefined SQL binding');
        const sql = normalizeSql(query);
        const call = { sql, params, connectionId: context?.id ?? null };
        calls.push(call);
        await hooks.beforeQuery?.(call);
        if (sql.includes('get_lock(')) {
            if (Object.hasOwn(hooks, 'getLockResult')) return [{ acquired: hooks.getLockResult }];
            const name = params[0];
            if (!waiters.has(name)) waiters.set(name, []);
            while (lockOwners.has(name) && lockOwners.get(name) !== context) {
                hooks.onLockWait?.(call);
                await new Promise(resolve => waiters.get(name).push(resolve));
            }
            lockOwners.set(name, context);
            const result = [{ acquired: 1 }];
            await hooks.afterQuery?.(call, result);
            return result;
        }
        if (sql.includes('release_lock(')) {
            if (Object.hasOwn(hooks, 'releaseLockResult')) return [{ released: hooks.releaseLockResult }];
            releaseLock(context, params[0]);
            return [{ released: 1 }];
        }
        const rows = context?.users || users;
        let result;
        if (sql.startsWith('select') && sql.includes('from admin_users')) {
            if (sql.includes('where id = ?')) {
                result = rows.filter(user => user.id === Number(params[0]));
            } else if (sql.includes('username in (?, ?)')) {
                result = rows.filter(user => (
                    [params[0], params[1]].some(value => equal(user.username, value))
                    || [params[2], params[3]].some(value => equal(user.email, value))
                ) && (!sql.includes('id <> ?') || user.id !== Number(params[4])));
            } else if (sql.includes('username = ? or email = ?')) {
                result = rows.filter(user => equal(user.username, params[0]) || equal(user.email, params[1]));
            } else {
                throw new Error(`지원하지 않는 관리자 조회: ${sql}`);
            }
            result = result.map(user => ({ ...user }));
        } else if (sql.startsWith('insert into admin_users')) {
            const [username, email, password_hash, full_name, role] = params;
            const id = nextUserId++;
            rows.push({ id, username, email, password_hash, full_name, role, is_active: 1 });
            result = { insertId: id, affectedRows: 1 };
        } else if (sql.startsWith('update admin_users')) {
            const user = rows.find(user => user.id === Number(params.at(-1)));
            let index = 0;
            const assignments = sql.slice(sql.indexOf(' set ') + 5, sql.lastIndexOf(' where '));
            if (user) {
                for (const match of assignments.matchAll(/(?:^|,\s*)(\w+)\s*=\s*\?/g)) {
                    user[match[1]] = params[index++];
                }
            }
            result = { affectedRows: user ? 1 : 0 };
        } else if (sql.startsWith('update admin_sessions')) {
            result = { affectedRows: 0 };
        } else {
            throw new Error(`지원하지 않는 SQL: ${sql}`);
        }
        await hooks.afterQuery?.(call, result);
        return result;
    };
    const pool = {
        getConnection: async () => {
            const context = { id: ++nextConnectionId, users: null };
            const event = async name => {
                calls.push({ event: name, connectionId: context.id });
                await hooks.beforeEvent?.(name, context.id);
            };
            return {
                execute: async (query, params) => [await execute(query, params, context)],
                beginTransaction: async () => {
                    await event('begin');
                    context.users = users.map(user => ({ ...user }));
                },
                commit: async () => {
                    await event('commit');
                    users.splice(0, users.length, ...context.users);
                    context.users = null;
                },
                rollback: async () => {
                    await event('rollback');
                    context.users = null;
                },
                release: () => { calls.push({ event: 'release', connectionId: context.id }); },
                destroy: () => {
                    calls.push({ event: 'destroy', connectionId: context.id });
                    releaseLock(context);
                }
            };
        }
    };
    stubRootModule(['db.ts'], pool);
    stubRootModule(['models', 'db-utils.ts'], {
        executeQuery: execute,
        executeQuerySingle: async (query, params) => (await execute(query, params))[0] || null,
        executeConnectionQuery: async (connection, query, params) => (await connection.execute(query, params))[0],
        executeConnectionQuerySingle: async (connection, query, params) => (
            (await connection.execute(query, params))[0][0] || null
        ),
        ...require(resolveFromRoot(['models', 'db-utils', 'transaction.ts']))
    });
    stubRootModule(['log.ts'], createNoopLogger());
    return { AdminUsers: require(resolveFromRoot(['models', 'admin-users.ts'])), users, calls, hooks };
};

module.exports = { createAdminIdentityFixture };
