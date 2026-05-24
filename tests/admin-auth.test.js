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

    stubRootModule(['models', 'db-utils.js'], dbUtils);
    stubRootModule(['log.js'], createNoopLogger());

    const AdminUsers = require(resolveFromRoot(['models', 'admin-users.js']));
    return { AdminUsers, sessions, queryCalls };
};

const loadAuthMiddleware = (AdminUsers, logger = createNoopLogger()) => {
    clearRootModules([
        ['middleware', 'auth.js'],
        ['models', 'admin-users.js'],
        ['models', 'admin-activity-logs.js'],
        ['log.js']
    ]);

    stubRootModule(['models', 'admin-users.js'], AdminUsers);
    stubRootModule(['models', 'admin-activity-logs.js'], {});
    stubRootModule(['log.js'], logger);

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

test('AdminUsers.rotateRefreshSession replaces the stored refresh token hash', async () => {
    const { AdminUsers, sessions } = await createAdminUsersFixture();

    const { user, refreshToken } = await AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'unit-agent');
    const decoded = AdminUsers.verifyRefreshToken(refreshToken);
    const newRefreshToken = await AdminUsers.rotateRefreshSession(refreshToken, decoded, user, '127.0.0.1');

    assert.notEqual(newRefreshToken, refreshToken);
    assert.equal(sessions[0].refresh_token_hash, AdminUsers.hashToken(newRefreshToken));
    assert.notEqual(sessions[0].refresh_token_hash, AdminUsers.hashToken(refreshToken));
    assert.equal(AdminUsers.verifyRefreshToken(newRefreshToken).sid, decoded.sid);

    await assert.rejects(
        () => AdminUsers.verifyRefreshSession(refreshToken, decoded),
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

test('AdminUsers.changePassword revokes other active sessions for the admin', async () => {
    const { AdminUsers, sessions } = await createAdminUsersFixture();

    const firstLogin = await AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'first-agent');
    const secondLogin = await AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'second-agent');
    const currentSessionId = AdminUsers.verifyToken(firstLogin.token).sid;
    const otherSessionId = AdminUsers.verifyToken(secondLogin.token).sid;

    await AdminUsers.changePassword(1, 'correct-password', 'new-password', currentSessionId);

    assert.equal(sessions.find((session) => session.session_id === currentSessionId).revoked_at, null);
    assert.ok(sessions.find((session) => session.session_id === otherSessionId).revoked_at instanceof Date);
});

test('AdminUsers.cleanupExpiredSessions removes expired and old revoked sessions', async () => {
    const { AdminUsers, sessions } = await createAdminUsersFixture();

    await AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'active-agent');
    sessions.push({
        session_id: 'expired-session',
        admin_id: 1,
        refresh_token_hash: 'expired',
        expires_at: new Date(Date.now() - 1000),
        revoked_at: null
    });
    sessions.push({
        session_id: 'old-revoked-session',
        admin_id: 1,
        refresh_token_hash: 'old-revoked',
        expires_at: new Date(Date.now() + 100000),
        revoked_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    });

    const deletedCount = await AdminUsers.cleanupExpiredSessions(7);

    assert.equal(deletedCount, 2);
    assert.equal(sessions.some((session) => session.session_id === 'expired-session'), false);
    assert.equal(sessions.some((session) => session.session_id === 'old-revoked-session'), false);
    assert.equal(sessions.length, 1);
});

test('AdminUsers.update can explicitly clear nullable profile fields', async () => {
    const { AdminUsers, queryCalls } = await createAdminUsersFixture();

    await AdminUsers.update(1, {
        full_name: null,
        is_active: false
    });

    const updateCall = queryCalls.find((call) => call.sql.startsWith('update admin_users'));
    assert.ok(updateCall);
    assert.equal(updateCall.sql.includes('coalesce'), false);
    assert.equal(updateCall.sql.includes('full_name = ?'), true);
    assert.equal(updateCall.sql.includes('is_active = ?'), true);
    assert.equal(updateCall.sql.includes('username = ?'), false);
    assert.deepEqual(updateCall.params, [null, false, 1]);
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
        rotateRefreshSession: async (refreshToken, decoded, user, ipAddress) => {
            verifiedRefreshSession = true;
            assert.equal(refreshToken, 'refresh-token');
            assert.equal(decoded.sid, 'session-2');
            assert.equal(user.id, 1);
            assert.equal(ipAddress, '127.0.0.1');
            return 'new-refresh-token';
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
    assert.equal(res.headers['X-New-Refresh-Token'], 'new-refresh-token');
    assert.equal(req.admin.sessionId, 'session-2');
});

test('requirePermission hides internal permission lookup errors from responses', async () => {
    const logCalls = [];
    const { requirePermission } = loadAuthMiddleware({
        hasPermission: async () => {
            throw new Error('database permission lookup failed');
        }
    }, {
        error: (...args) => logCalls.push(args),
        warn: () => {},
        info: () => {}
    });

    const req = {
        requestId: 'req-permission-error',
        admin: {
            id: 7,
            username: 'editor',
            role: 'editor'
        }
    };
    const res = createResponse();
    let nextCalled = false;

    await requirePermission('projects.create')(req, res, () => {
        nextCalled = true;
    });

    assert.equal(res.statusCode, 500);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, '권한 확인 중 오류가 발생했습니다.');
    assert.equal(Object.prototype.hasOwnProperty.call(res.body, 'error'), false);
    assert.equal(nextCalled, false);
    assert.equal(logCalls.length, 1);
    assert.equal(logCalls[0][0], '권한 확인 실패');
});
