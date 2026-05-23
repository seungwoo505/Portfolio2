const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');

const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

process.env.JWT_SECRET = 'unit-test-access-secret';
process.env.JWT_REFRESH_SECRET = 'unit-test-refresh-secret';

const normalizeSql = (query) => query.replace(/\s+/g, ' ').trim().toLowerCase();

const createAdminUsersFixture = async () => {
    clearRootModules([
        ['models', 'admin-users.js'],
        ['models', 'db-utils.js'],
        ['log.js']
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

            if (sql.includes('update admin_sessions') && sql.includes('last_used_at')) {
                const session = sessions.find((item) => item.session_id === params[0]);
                if (session) {
                    session.last_used_at = new Date();
                }
                return { affectedRows: session ? 1 : 0 };
            }

            if (sql.includes('update admin_sessions') && sql.includes('revoked_at')) {
                const session = sessions.find((item) => item.session_id === params[0]);
                if (session) {
                    session.revoked_at = new Date();
                }
                return { affectedRows: session ? 1 : 0 };
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

    stubRootModule(['models', 'db-utils.js'], dbUtils);
    stubRootModule(['log.js'], createNoopLogger());

    const AdminUsers = require(resolveFromRoot(['models', 'admin-users.js']));
    return { AdminUsers, sessions, queryCalls };
};

const loadAuthMiddleware = (AdminUsers) => {
    clearRootModules([
        ['middleware', 'auth.js'],
        ['models', 'admin-users.js'],
        ['models', 'admin-activity-logs.js'],
        ['log.js']
    ]);

    stubRootModule(['models', 'admin-users.js'], AdminUsers);
    stubRootModule(['models', 'admin-activity-logs.js'], {});
    stubRootModule(['log.js'], createNoopLogger());

    return require(resolveFromRoot(['middleware', 'auth.js']));
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

test('AdminUsers.login creates a server session with a hashed refresh token', async () => {
    const { AdminUsers, sessions } = await createAdminUsersFixture();

    const result = await AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'unit-agent');
    const accessPayload = AdminUsers.verifyToken(result.token);
    const refreshPayload = AdminUsers.verifyRefreshToken(result.refreshToken);

    assert.equal(result.user.password_hash, undefined);
    assert.equal(sessions.length, 1);
    assert.equal(sessions[0].session_id, accessPayload.sid);
    assert.equal(refreshPayload.sid, accessPayload.sid);
    assert.equal(sessions[0].admin_id, 1);
    assert.equal(sessions[0].ip_address, '127.0.0.1');
    assert.equal(sessions[0].user_agent, 'unit-agent');
    assert.notEqual(sessions[0].refresh_token_hash, result.refreshToken);
    assert.equal(sessions[0].refresh_token_hash, AdminUsers.hashToken(result.refreshToken));
});

test('AdminUsers.verifyRefreshSession checks the stored hash and marks usage', async () => {
    const { AdminUsers, sessions } = await createAdminUsersFixture();

    const { refreshToken } = await AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'unit-agent');
    const decoded = AdminUsers.verifyRefreshToken(refreshToken);
    const session = await AdminUsers.verifyRefreshSession(refreshToken, decoded);

    assert.equal(session.session_id, decoded.sid);
    assert.ok(sessions[0].last_used_at instanceof Date);

    await assert.rejects(
        () => AdminUsers.verifyRefreshSession('wrong-refresh-token', decoded),
        /Refresh Token 세션/
    );
});

test('AdminUsers.logout revokes the active session', async () => {
    const { AdminUsers, sessions } = await createAdminUsersFixture();

    const { token } = await AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'unit-agent');
    const decoded = AdminUsers.verifyToken(token);

    await AdminUsers.assertActiveSession(decoded.sid, decoded.id);
    await AdminUsers.logout(token);

    assert.ok(sessions[0].revoked_at instanceof Date);
    await assert.rejects(
        () => AdminUsers.assertActiveSession(decoded.sid, decoded.id),
        /세션이 만료되었거나 로그아웃/
    );
});

test('authenticateToken accepts an access token only when its session is active', async () => {
    let assertedSession = false;
    const AdminUsers = {
        verifyToken: () => ({
            id: 1,
            username: 'admin',
            role: 'super_admin',
            sid: 'session-1',
            ip: '127.0.0.1'
        }),
        getById: async () => ({
            id: 1,
            username: 'admin',
            role: 'super_admin',
            is_active: 1
        }),
        assertActiveSession: async (sessionId, adminId) => {
            assertedSession = true;
            assert.equal(sessionId, 'session-1');
            assert.equal(adminId, 1);
        }
    };
    const { authenticateToken } = loadAuthMiddleware(AdminUsers);
    const req = {
        headers: { authorization: 'Bearer access-token' },
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' }
    };
    const res = createResponse();
    let nextCalled = false;

    await authenticateToken(req, res, () => {
        nextCalled = true;
    });

    assert.equal(assertedSession, true);
    assert.equal(nextCalled, true);
    assert.deepEqual(req.admin, {
        id: 1,
        username: 'admin',
        role: 'super_admin',
        sessionId: 'session-1'
    });
});

test('authenticateToken refreshes an expired access token with a valid refresh session', async () => {
    let verifiedRefreshSession = false;
    const AdminUsers = {
        verifyToken: () => {
            throw new Error('expired');
        },
        verifyRefreshToken: (token) => {
            assert.equal(token, 'refresh-token');
            return {
                id: 1,
                username: 'admin',
                sid: 'session-2',
                ip: '127.0.0.1'
            };
        },
        getById: async () => ({
            id: 1,
            username: 'admin',
            role: 'admin',
            is_active: 1
        }),
        verifyRefreshSession: async (refreshToken, decoded) => {
            verifiedRefreshSession = true;
            assert.equal(refreshToken, 'refresh-token');
            assert.equal(decoded.sid, 'session-2');
        },
        generateToken: (user, ipAddress, sessionId) => {
            assert.equal(user.id, 1);
            assert.equal(ipAddress, '127.0.0.1');
            assert.equal(sessionId, 'session-2');
            return 'new-access-token';
        }
    };
    const { authenticateToken } = loadAuthMiddleware(AdminUsers);
    const req = {
        headers: {
            authorization: 'Bearer expired-access-token',
            'x-refresh-token': 'refresh-token'
        },
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' }
    };
    const res = createResponse();
    let nextCalled = false;

    await authenticateToken(req, res, () => {
        nextCalled = true;
    });

    assert.equal(verifiedRefreshSession, true);
    assert.equal(nextCalled, true);
    assert.equal(res.headers['X-New-Token'], 'new-access-token');
    assert.equal(req.admin.sessionId, 'session-2');
});
