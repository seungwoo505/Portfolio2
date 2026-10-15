const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const bcrypt = require('bcryptjs');
const { setImmediate: nextTurn } = require('node:timers/promises');
const { createAdminUsersFixture, loadAuthMiddleware } = require('./helpers/admin-auth-fixture');
const { clearRootModules, stubRootModule } = require('./helpers/module-loader');
const { startRouterServer, waitFor } = require('./helpers/http-route-server');
const { redact } = require('../logger/redaction.ts');

const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};

const loadAuditRoutes = (fixture) => {
    const audit = [];
    const errors = [];
    const logger = new Proxy({ redact, error: (...args) => errors.push(args) }, {
        get: (target, key) => target[key] || (() => {})
    });
    const auth = loadAuthMiddleware(fixture.AdminUsers, logger);
    require('../models/admin-activity-logs.ts').log = async (...args) => { audit.push(args); return 1; };
    clearRootModules([
        ['routes', 'admin', 'auth', 'profile.ts'], ['routes', 'admin', 'auth', 'common.ts'],
        ['routes', 'admin', 'users', 'collection.ts'], ['routes', 'admin', 'users', 'common.ts'],
        ['middleware', 'request-timeout.ts']
    ]);
    stubRootModule(['routes', 'admin', 'common.ts'], {
        logger, buildErrorLog: error => ({ error: error.message })
    });
    return { auth, audit, errors };
};

const request = async (baseUrl, path, token, body, method = 'PUT') => {
    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify(body)
    });
    return { status: response.status, body: await response.json() };
};

for (const failWrite of [false, true]) {
    test(`시간 초과 뒤 비밀번호 ${failWrite ? '변경 실패는 감사 성공으로 기록하지 않는다' : '변경 성공과 세션 회수를 정확히 한 번 감사 기록한다'}`, { timeout: 10000 }, async () => {
        const updateReached = deferred();
        const releaseUpdate = deferred();
        const fixture = await createAdminUsersFixture({ hooks: { beforeQuery: async call => {
            if (call.sql.startsWith('update admin_users') && call.sql.includes('password_hash = ?')) {
                updateReached.resolve();
                await releaseUpdate.promise;
                if (failWrite) throw new Error('DB write unavailable');
            }
        } } });
        const current = await fixture.AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'audit-test');
        await fixture.AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'audit-test');
        const originalHash = fixture.adminUser.password_hash;
        const { audit, errors } = loadAuditRoutes(fixture);
        const beforeReleases = fixture.transactionCalls.filter(call => call.event === 'release').length;
        const previousTimeout = process.env.REQUEST_TIMEOUT;
        process.env.REQUEST_TIMEOUT = '30';
        let timeoutMiddleware;
        try { timeoutMiddleware = require('../middleware/request-timeout.ts').requestTimeoutMiddleware; }
        finally {
            if (previousTimeout === undefined) delete process.env.REQUEST_TIMEOUT;
            else process.env.REQUEST_TIMEOUT = previousTimeout;
        }
        const app = express();
        app.use(express.json());
        app.use(timeoutMiddleware);
        app.use('/admin', require('../routes/admin/auth/profile.ts'));
        const handlerErrors = [];
        app.use((error, _req, _res, _next) => { handlerErrors.push(error.code || error.message); });
        const server = await startRouterServer(app);
        try {
            const responsePromise = request(server.baseUrl, '/admin/password', current.token, {
                oldPassword: 'correct-password', newPassword: 'NewStrongPass123'
            });
            await updateReached.promise;
            const response = await responsePromise;
            assert.equal(response.status, 408);
            assert.equal(fixture.adminUser.password_hash, originalHash);
            assert.equal(audit.length, 0);
            releaseUpdate.resolve();
            await waitFor(() => fixture.transactionCalls.filter(call => call.event === 'release').length > beforeReleases, 2000);
            await nextTurn();
            await nextTurn();
            assert.equal(await bcrypt.compare('NewStrongPass123', fixture.adminUser.password_hash), !failWrite);
            assert.equal(Boolean(fixture.sessions[1].revoked_at), !failWrite);
            assert.equal(audit.length, failWrite ? 0 : 1);
            if (!failWrite) {
                assert.equal(audit[0][0], 1);
                assert.equal(audit[0][1], 'change_password');
                assert.equal(audit[0][4].includes('NewStrongPass123'), false);
                assert.equal(errors.length, 0);
            }
            assert.deepEqual(handlerErrors, [], '완료된 응답에 다시 쓰지 않아야 한다');
        } finally {
            releaseUpdate.resolve();
            await server.close();
        }
    });
}

for (const suppliedId of [undefined, 999]) {
    test(`관리자 생성 감사 대상은 ${suppliedId === undefined ? '본문 ID가 없어도' : '본문에 다른 ID가 있어도'} 서버의 생성 ID를 사용한다`, async () => {
        const fixture = await createAdminUsersFixture();
        const login = await fixture.AdminUsers.login('admin', 'correct-password', '127.0.0.1', 'audit-test');
        const getById = fixture.AdminUsers.getById.bind(fixture.AdminUsers);
        // 생성 저장/조회만 DB 경계로 대체하고 인증, payload, 감사 미들웨어는 실제 코드이다.
        fixture.AdminUsers.create = async () => 2;
        fixture.AdminUsers.getById = async id => Number(id) === 2
            ? { id: 2, username: 'newadmin', role: 'admin' } : getById(id);
        const { audit } = loadAuditRoutes(fixture);
        const app = express();
        app.use(express.json());
        app.use('/admin', require('../routes/admin/users/collection.ts'));
        const server = await startRouterServer(app);
        try {
            const response = await request(server.baseUrl, '/admin/users', login.token, {
                id: suppliedId, username: 'newadmin', email: 'newadmin@example.com',
                password: 'StrongPass123', role: 'admin'
            }, 'POST');
            assert.equal(response.status, 201);
            assert.equal(response.body.data.id, 2);
            await nextTurn();
            assert.equal(audit.length, 1, '성공 응답과 finish 이벤트가 중복 감사 기록을 만들면 안 된다');
            assert.deepEqual(audit[0].slice(0, 4), [1, 'create_admin', 'users', 2]);
        } finally { await server.close(); }
    });
}

for (const status of [200, 400]) {
    test(`실패한 관리자 변경은 HTTP ${status}에서도 성공 감사 기록을 만들지 않는다`, async () => {
        const fixture = await createAdminUsersFixture();
        const { auth, audit } = loadAuditRoutes(fixture);
        const router = express.Router();
        router.use((req, _res, next) => { req.admin = { id: 1 }; next(); });
        router.put('/admin/users/:id', auth.logActivity('update_admin'), (_req, res) => res.status(status).json({ success: false }));
        const server = await startRouterServer(router, { json: true });
        try {
            const result = await request(server.baseUrl, '/admin/users/2', 'unused', { id: 999 });
            assert.equal(result.status, status);
            await nextTurn();
            assert.equal(audit.length, 0);
        } finally { await server.close(); }
    });
}

test('수정 응답에 ID가 없으면 본문 ID 대신 URL의 대상을 정확히 한 번 기록한다', async () => {
    const fixture = await createAdminUsersFixture();
    const { auth, audit } = loadAuditRoutes(fixture);
    const router = express.Router();
    router.use((req, _res, next) => { req.admin = { id: 1 }; next(); });
    router.put('/admin/users/:id', auth.logActivity('update_admin'), (_req, res) => res.json({ success: true }));
    const server = await startRouterServer(router, { json: true });
    try {
        const result = await request(server.baseUrl, '/admin/users/2', 'unused', { id: 999 });
        assert.equal(result.status, 200);
        await nextTurn();
        assert.equal(audit.length, 1);
        assert.equal(audit[0][3], '2');
    } finally { await server.close(); }
});
