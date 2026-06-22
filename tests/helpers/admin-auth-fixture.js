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

const createAdminUsersFixture = async () => {
    clearRootModules([
        ...adminUsersModules,
        ['models', 'db-utils.ts'],
        ['log.ts']
    ]);

    const sessions = [];
    const queryCalls = [];
    const passwordHash = await bcrypt.hash('correct-password', 4);
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

    const dbUtils = {
        executeQuery: async (query, params = []) => {
            const sql = normalizeSql(query);
            queryCalls.push({ sql, params });

            if (sql.includes('update admin_users')) {
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
                const session = sessions.find((item) => item.session_id === params[2]);
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

            return { affectedRows: 1 };
        },
        executeQuerySingle: async (query, params = []) => {
            const sql = normalizeSql(query);
            queryCalls.push({ sql, params });

            if (sql.includes('from admin_users') && sql.includes('(username = ? or email = ?)')) {
                return { ...adminUser };
            }

            if (sql.includes('from admin_users') && sql.includes('where id = ?')) {
                return { ...adminUser };
            }

            if (sql.includes('from admin_sessions')) {
                const session = sessions.find((item) => (
                    item.session_id === params[0]
                    && !item.revoked_at
                    && item.expires_at > new Date()
                ));
                return session ? { ...session } : null;
            }

            return null;
        }
    };

    stubRootModule(['models', 'db-utils.ts'], dbUtils);
    stubRootModule(['log.ts'], createNoopLogger());

    const AdminUsers = require(resolveFromRoot(['models', 'admin-users.ts']));
    return { AdminUsers, sessions, queryCalls };
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
