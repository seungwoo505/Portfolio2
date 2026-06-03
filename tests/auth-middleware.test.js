const test = require('node:test');
const assert = require('node:assert/strict');
const { createResponse, loadAuthMiddleware } = require('./helpers/admin-auth-fixture');

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

test('requirePermission hides permission name from forbidden responses', async () => {
    const logCalls = [];
    const { requirePermission } = loadAuthMiddleware({
        hasPermission: async () => false
    }, {
        error: () => {},
        warn: (...args) => logCalls.push(args),
        info: () => {}
    });

    const req = {
        requestId: 'req-permission-denied',
        admin: {
            id: 8,
            username: 'editor',
            role: 'editor'
        }
    };
    const res = createResponse();
    let nextCalled = false;

    await requirePermission('projects.create')(req, res, () => {
        nextCalled = true;
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, '권한이 부족합니다.');
    assert.equal(Object.prototype.hasOwnProperty.call(res.body, 'required_permission'), false);
    assert.equal(nextCalled, false);
    assert.equal(logCalls.length, 1);
    assert.equal(logCalls[0][0], '권한 인가 실패');
});

test('requireRole hides role details from forbidden responses', () => {
    const { requireRole } = loadAuthMiddleware({});
    const req = {
        requestId: 'req-role-denied',
        admin: {
            id: 9,
            username: 'editor',
            role: 'editor'
        }
    };
    const res = createResponse();
    let nextCalled = false;

    requireRole('super_admin')(req, res, () => {
        nextCalled = true;
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, '접근 권한이 부족합니다.');
    assert.equal(Object.prototype.hasOwnProperty.call(res.body, 'required_roles'), false);
    assert.equal(Object.prototype.hasOwnProperty.call(res.body, 'current_role'), false);
    assert.equal(nextCalled, false);
});

test('restrictToIPs hides rejected client IP from responses', () => {
    const { restrictToIPs } = loadAuthMiddleware({});
    const req = {
        requestId: 'req-ip-denied',
        ip: '203.0.113.10',
        connection: {
            remoteAddress: '203.0.113.10'
        }
    };
    const res = createResponse();
    let nextCalled = false;

    restrictToIPs(['127.0.0.1'])(req, res, () => {
        nextCalled = true;
    });

    assert.equal(res.statusCode, 403);
    assert.equal(res.body.success, false);
    assert.equal(res.body.message, '허용되지 않은 IP 주소입니다.');
    assert.equal(Object.prototype.hasOwnProperty.call(res.body, 'ip'), false);
    assert.equal(nextCalled, false);
});
