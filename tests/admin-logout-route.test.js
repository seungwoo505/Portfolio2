const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { createAdminUsersFixture, loadAuthMiddleware } = require('./helpers/admin-auth-fixture');
const { clearRootModules, createNoopLogger, stubRootModule } = require('./helpers/module-loader');
const { startRouterServer } = require('./helpers/http-route-server');

const logout = async ({ failRevoke = false, failActivity = false } = {}) => {
    const { AdminUsers, sessions } = await createAdminUsersFixture();
    const login = await AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'unit-agent');
    const { id, username, role, sid, ip } = jwt.decode(login.token);
    const expiredToken = jwt.sign({ id, username, role, sid, ip }, process.env.JWT_SECRET, { expiresIn: -1 });
    const { authenticateToken } = loadAuthMiddleware(AdminUsers);
    if (failRevoke) AdminUsers.revokeSession = async () => { throw new Error('DB failure'); };
    stubRootModule(['models', 'admin-activity-logs.ts'], {
        log: async () => { if (failActivity) throw new Error('activity failure'); }
    });
    stubRootModule(['routes', 'admin', 'common.ts'], {
        logger: createNoopLogger(), buildErrorLog: error => ({ error: error.message })
    });
    stubRootModule(['middleware', 'auth.ts'], { authenticateToken });
    clearRootModules([
        ['routes', 'admin', 'auth', 'common.ts'],
        ['routes', 'admin', 'auth', 'session', 'logout.ts']
    ]);
    const server = await startRouterServer(require('../routes/admin/auth/session/logout.ts'));
    try {
        const response = await fetch(`${server.baseUrl}/logout`, {
            method: 'POST',
            headers: { authorization: `Bearer ${expiredToken}`, 'x-refresh-token': login.refreshToken }
        });
        return { response, body: await response.json(), revoked: sessions[0].revoked_at !== null };
    } finally {
        await server.close();
    }
};

test('만료된 액세스 토큰을 자동 갱신한 뒤 로그아웃해도 세션이 폐기된다', async () => {
    const { response, body, revoked } = await logout();
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(revoked, true);
    assert.equal(response.headers.get('x-new-token'), null);
    assert.equal(response.headers.get('x-new-refresh-token'), null);
});

test('세션 폐기 실패를 로그아웃 성공으로 응답하지 않는다', async () => {
    const { response, body, revoked } = await logout({ failRevoke: true });
    assert.equal(response.status, 500);
    assert.equal(body.success, false);
    assert.equal(revoked, false);
});

test('활동 로그 실패가 실제 로그아웃 성공을 실패로 바꾸지 않는다', async () => {
    const { response, body, revoked } = await logout({ failActivity: true });
    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(revoked, true);
});
