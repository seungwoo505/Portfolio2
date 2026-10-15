const bcrypt = require('bcryptjs');
const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./module-loader');

process.env.JWT_SECRET = 'unit-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'unit-test-refresh-secret';

const normalizeSql = (query) => query.replace(/\s+/g, ' ').trim().toLowerCase();

const adminUsersModules = [
    ['models', 'admin-users.ts'],
    ['models', 'admin-users', 'index.ts'],
    ['models', 'admin-users', 'common.ts'],
    ['models', 'admin-users', 'auth.ts'],
    ['models', 'admin-users', 'tokens.ts'],
    ['models', 'admin-users', 'sessions.ts'],
    ['models', 'admin-users', 'users.ts'],
    ['models', 'admin-users', 'permissions.ts']
];

const authMiddlewareModules = [
    ['middleware', 'auth.ts'],
    ['middleware', 'auth', 'index.ts'],
    ['middleware', 'auth', 'common.ts'],
    ['middleware', 'auth', 'token', 'index.ts'],
    ['middleware', 'auth', 'token', 'access.ts'],
    ['middleware', 'auth', 'token', 'context.ts'],
    ['middleware', 'auth', 'token', 'refresh.ts'],
    ['middleware', 'auth', 'authorization.ts'],
    ['middleware', 'auth', 'activity.ts'],
    ['middleware', 'auth', 'activity', 'details.ts'],
    ['middleware', 'auth', 'activity', 'labels.ts'],
    ['middleware', 'auth', 'activity', 'request.ts']
];

const createAdminUsersFixture = async ({ password = 'correct-password', hooks = {} } = {}) => {
    clearRootModules([
        ...adminUsersModules,
        ['models', 'db-utils.ts'],
        ['models', 'db-utils', 'transaction.ts'],
        ['db.ts'],
        ['log.ts']
    ]);

    const sessions = [];
    const queryCalls = [];
    const transactionCalls = [];
    const passwordHash = await bcrypt.hash(password, 4);
    const adminUser = {
        id: 1,
        username: 'admin',
        email: 'admin@example.com',
        full_name: 'Admin',
        role: 'super_admin',
        is_active: 1,
        password_hash: passwordHash,
        failed_login_attempts: 0,
        locked_until: null
    };

    let lockOwner = null;
    let nextConnectionId = 0;
    const lockWaiters = [];
    const unlock = (context) => {
        if (lockOwner === context) {
            lockOwner = null;
            lockWaiters.splice(0).forEach(resolve => resolve());
        }
    };
    const lockUser = async (context, call) => {
        while (lockOwner && lockOwner !== context) {
            hooks.onLockWait?.(call);
            await new Promise(resolve => lockWaiters.push(resolve));
        }
        lockOwner = context;
    };
    const execute = async (query, params = [], context = null) => {
        const sql = normalizeSql(query);
        const call = { sql, params, connectionId: context?.id ?? null };
        queryCalls.push(call);
        await hooks.beforeQuery?.(call);
        const autocommit = context || {};
        const needsUserLock = sql.startsWith('update admin_users')
            || sql.startsWith('update admin_sessions')
            || (sql.includes('from admin_users') && sql.includes('for update'));
        if (needsUserLock) await lockUser(autocommit, call);
        try {
            if (context && !context.state) {
                context.state = {
                    adminUser: { ...adminUser },
                    sessions: sessions.map(session => ({ ...session }))
                };
            }
            const state = context?.state || { adminUser, sessions };
            const result = applyQuery(sql, params, state);
            await hooks.afterQuery?.(call, result);
            return result;
        } finally {
            if (!context) unlock(autocommit);
        }
    };
    const applyQuery = (sql, params, state) => {
        const { adminUser, sessions } = state;

        if (sql.includes('update admin_users')) {
            let index = 0;
            const assignments = sql.slice(sql.indexOf(' set ') + 5, sql.lastIndexOf(' where '));
            for (const match of assignments.matchAll(/(?:^|,\s*)(\w+)\s*=\s*\?/g)) {
                adminUser[match[1]] = params[index++];
            }
            if (sql.includes('failed_login_attempts = 0')) {
                adminUser.failed_login_attempts = 0;
                adminUser.locked_until = null;
            } else if (sql.includes('failed_login_attempts = failed_login_attempts + 1')) {
                // MySQL 단일 테이블 UPDATE는 앞에서 증가한 값을 뒤 CASE에서 읽는다.
                adminUser.failed_login_attempts += 1;
                const threshold = Number(sql.match(/when failed_login_attempts >= (\d+)/)?.[1]);
                if (adminUser.failed_login_attempts >= threshold) {
                    adminUser.locked_until = new Date(Date.now() + 30 * 60 * 1000);
                }
            }
            return { affectedRows: 1 };
        }

        if (sql.includes('insert into admin_sessions')) {
            sessions.push({
                session_id: params[0],
                admin_id: params[1],
                refresh_token_hash: params[2],
                ip_address: params[3],
                user_agent: params[4],
                expires_at: params[5],
                revoked_at: null,
                last_used_at: null
            });
            return { insertId: sessions.length };
        }

        if (sql.includes('update admin_sessions') && sql.includes('refresh_token_hash')) {
            const session = sessions.find((item) => (
                item.session_id === params[2]
                && !item.revoked_at
                && (!sql.includes('and admin_id = ?') || Number(item.admin_id) === Number(params[3]))
                && (!sql.includes('and refresh_token_hash = ?') || item.refresh_token_hash === params[4])
                && (!sql.includes('and expires_at > now()') || item.expires_at > new Date())
            ));
            if (session) {
                session.refresh_token_hash = params[0];
                session.expires_at = params[1];
                session.last_used_at = new Date();
            }
            return { affectedRows: session ? 1 : 0 };
        }

        if (sql.includes('update admin_sessions') && sql.includes('last_used_at')) {
            const session = sessions.find((item) => item.session_id === params[0]);
            if (session) {
                session.last_used_at = new Date();
            }
            return { affectedRows: session ? 1 : 0 };
        }

        if (sql.includes('update admin_sessions') && sql.includes('admin_id = ?')) {
            const adminId = params[0];
            const exceptSessionId = params[1];
            let affectedRows = 0;
            sessions.forEach((session) => {
                if (
                    Number(session.admin_id) === Number(adminId)
                    && !session.revoked_at
                    && (!exceptSessionId || session.session_id !== exceptSessionId)
                ) {
                    session.revoked_at = new Date();
                    affectedRows += 1;
                }
            });
            return { affectedRows };
        }

        if (sql.includes('update admin_sessions') && sql.includes('revoked_at')) {
            const session = sessions.find((item) => item.session_id === params[0]);
            if (session) {
                session.revoked_at = new Date();
            }
            return { affectedRows: session ? 1 : 0 };
        }

        if (sql.includes('delete from admin_sessions')) {
            const now = new Date();
            const revokedBefore = params[0];
            const beforeCount = sessions.length;
            for (let index = sessions.length - 1; index >= 0; index -= 1) {
                if (
                    sessions[index].expires_at < now
                    || (sessions[index].revoked_at && sessions[index].revoked_at < revokedBefore)
                ) {
                    sessions.splice(index, 1);
                }
            }
            return { affectedRows: beforeCount - sessions.length };
        }

        if (sql.includes('from admin_users') && sql.includes('(username = ? or email = ?)')) {
            return (params[0] === adminUser.username || params[0] === adminUser.email)
                && adminUser.is_active ? [{ ...adminUser }] : [];
        }

        if (sql.includes('from admin_users') && sql.includes('where id = ?')) {
            return Number(params[0]) === adminUser.id ? [{ ...adminUser }] : [];
        }

        if (sql.includes('from admin_sessions')) {
            const session = sessions.find((item) => (
                item.session_id === params[0]
                && !item.revoked_at
                && item.expires_at > new Date()
            ));
            return session ? [{ ...session }] : [];
        }

        return { affectedRows: 1 };
    };
    const pool = {
        getConnection: async () => {
            const context = { id: ++nextConnectionId, state: null };
            return {
                beginTransaction: async () => {
                    transactionCalls.push({ event: 'begin', connectionId: context.id });
                },
                execute: async (query, params) => [await execute(query, params, context)],
                commit: async () => {
                    transactionCalls.push({ event: 'commit', connectionId: context.id });
                    if (context.state) {
                        Object.assign(adminUser, context.state.adminUser);
                        sessions.splice(0, sessions.length, ...context.state.sessions);
                    }
                    unlock(context);
                },
                rollback: async () => {
                    transactionCalls.push({ event: 'rollback', connectionId: context.id });
                    unlock(context);
                },
                release: () => {
                    transactionCalls.push({ event: 'release', connectionId: context.id });
                    unlock(context);
                }
            };
        }
    };
    stubRootModule(['db.ts'], pool);
    const dbUtils = {
        executeQuery: execute,
        executeQuerySingle: async (query, params) => (await execute(query, params))[0] || null,
        executeConnectionQuery: async (connection, query, params) => (await connection.execute(query, params))[0],
        executeConnectionQuerySingle: async (connection, query, params) => (
            (await connection.execute(query, params))[0][0] || null
        ),
        ...require(resolveFromRoot(['models', 'db-utils', 'transaction.ts']))
    };

    stubRootModule(['models', 'db-utils.ts'], dbUtils);
    stubRootModule(['log.ts'], createNoopLogger());

    const AdminUsers = require(resolveFromRoot(['models', 'admin-users.ts']));
    return { AdminUsers, sessions, queryCalls, transactionCalls, adminUser, hooks };
};

const loadAuthMiddleware = (AdminUsers, logger = createNoopLogger()) => {
    clearRootModules([
        ...authMiddlewareModules,
        ...adminUsersModules,
        ['models', 'admin-activity-logs.ts'],
        ['log.ts']
    ]);

    stubRootModule(['models', 'admin-users.ts'], AdminUsers);
    stubRootModule(['models', 'admin-activity-logs.ts'], {});
    stubRootModule(['log.ts'], logger);

    return require(resolveFromRoot(['middleware', 'auth.ts']));
};

const createResponse = () => ({
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
        this.statusCode = code;
        return this;
    },
    json(payload) {
        this.body = payload;
        return this;
    },
    setHeader(name, value) {
        this.headers[name] = value;
    }
});

module.exports = {
    createAdminUsersFixture,
    createResponse,
    loadAuthMiddleware
};
