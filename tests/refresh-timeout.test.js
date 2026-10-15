const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const { setImmediate: nextTurn } = require('node:timers/promises');
const { createAdminUsersFixture, loadAuthMiddleware } = require('./helpers/admin-auth-fixture');
const { clearRootModules, createNoopLogger, stubRootModule } = require('./helpers/module-loader');
const { startRouterServer, waitFor } = require('./helpers/http-route-server');

const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};
const isRotation = call => call.sql.startsWith('update admin_sessions')
    && call.sql.includes('set refresh_token_hash = ?');

const createRefreshServer = async (fixture, { timeout = 1000 } = {}) => {
    const logger = createNoopLogger();
    const { authenticateToken } = loadAuthMiddleware(fixture.AdminUsers, logger);
    clearRootModules([
        ['routes', 'admin', 'auth', 'common.ts'],
        ['routes', 'admin', 'auth', 'session', 'refresh.ts'],
        ['middleware', 'request-timeout.ts']
    ]);
    stubRootModule(['routes', 'admin', 'common.ts'], {
        logger, buildErrorLog: error => ({ error: error.message })
    });
    const previousTimeout = process.env.REQUEST_TIMEOUT;
    process.env.REQUEST_TIMEOUT = String(timeout);
    let requestTimeoutMiddleware;
    try { ({ requestTimeoutMiddleware } = require('../middleware/request-timeout.ts')); }
    finally {
        if (previousTimeout === undefined) delete process.env.REQUEST_TIMEOUT;
        else process.env.REQUEST_TIMEOUT = previousTimeout;
    }
    const app = express();
    const observed = { protectedCalls: 0, handlerErrors: [], lateWrites: [], closed: deferred() };
    app.use(express.json());
    app.use((_req, res, next) => {
        res.once('close', () => observed.closed.resolve());
        for (const method of ['json', 'setHeader']) {
            const original = res[method];
            res[method] = function (...args) {
                if (this.writableEnded || this.destroyed) observed.lateWrites.push(method);
                return original.apply(this, args);
            };
        }
        next();
    });
    app.use(requestTimeoutMiddleware);
    app.use('/admin', require('../routes/admin/auth/session/refresh.ts'));
    app.get('/protected', authenticateToken, (_req, res) => {
        observed.protectedCalls += 1;
        res.json({ success: true });
    });
    app.use((error, _req, _res, _next) => { observed.handlerErrors.push(error.code || error.message); });
    return { ...await startRouterServer(app), observed };
};

const expiredAccessToken = (AdminUsers, login) => {
    const { id, username, role, sid, ip } = AdminUsers.verifyToken(login.token);
    return jwt.sign({ id, username, role, sid, ip }, process.env.JWT_SECRET, { expiresIn: -1 });
};

const refresh = async (server, mode, login, token, signal) => {
    const response = await fetch(`${server.baseUrl}${mode === 'explicit' ? '/admin/refresh' : '/protected'}`, {
        method: mode === 'explicit' ? 'POST' : 'GET',
        headers: mode === 'explicit'
            ? { 'Content-Type': 'application/json' }
            : { authorization: `Bearer ${token}`, 'x-refresh-token': login.refreshToken },
        body: mode === 'explicit' ? JSON.stringify({ refreshToken: login.refreshToken }) : undefined,
        signal
    });
    return { status: response.status, body: await response.json(), headers: response.headers };
};

for (const mode of ['explicit', 'automatic']) {
    for (const phase of ['beforeQuery', 'afterQuery']) {
        test(`${mode} 갱신 ${phase} 대기 중 408이면 교체를 취소하고 기존 refresh 토큰 재시도를 허용한다`, { timeout: 10000 }, async () => {
            const fixture = await createAdminUsersFixture();
            const login = await fixture.AdminUsers.login('admin', 'correct-password', '127.0.0.1');
            const token = expiredAccessToken(fixture.AdminUsers, login);
            const originalHash = fixture.sessions[0].refresh_token_hash;
            const reached = deferred();
            const release = deferred();
            let queryCompleted = false;
            fixture.hooks[phase] = async call => {
                if (isRotation(call)) { reached.resolve(); await release.promise; }
            };
            const afterQuery = fixture.hooks.afterQuery;
            fixture.hooks.afterQuery = async call => {
                await afterQuery?.(call);
                if (isRotation(call)) queryCompleted = true;
            };
            const server = await createRefreshServer(fixture, { timeout: 30 });
            try {
                const pending = refresh(server, mode, login, token);
                await reached.promise;
                const timedOut = await pending;
                assert.equal(timedOut.status, 408);
                assert.equal(timedOut.headers.get('x-new-refresh-token'), null);
                assert.equal(fixture.sessions[0].refresh_token_hash, originalHash);
                release.resolve();
                await waitFor(() => queryCompleted, 2000);
                await nextTurn();
                await nextTurn();
                assert.equal(fixture.sessions[0].refresh_token_hash, originalHash,
                    '408 응답 후에는 전달할 수 없는 새 refresh 토큰의 해시를 저장하면 안 된다');
                assert.deepEqual(server.observed.lateWrites, []);
                assert.deepEqual(server.observed.handlerErrors, []);
                assert.equal(server.observed.protectedCalls, 0);
                assert.ok(fixture.transactionCalls.some(call => call.event === 'rollback'));

                const retried = await refresh(server, mode, login, token);
                assert.equal(retried.status, 200, '취소된 갱신은 원래 토큰으로 다시 시도할 수 있어야 한다');
                const newRefreshToken = mode === 'explicit'
                    ? retried.body.data.refreshToken : retried.headers.get('x-new-refresh-token');
                assert.ok(newRefreshToken);
                assert.notEqual(newRefreshToken, login.refreshToken);
                await fixture.AdminUsers.verifyRefreshSession(newRefreshToken,
                    fixture.AdminUsers.verifyRefreshToken(newRefreshToken));
                assert.equal((await refresh(server, mode, login, token)).status, 401,
                    '정상 완료된 회전 후에는 이전 토큰을 재사용할 수 없어야 한다');
                assert.equal(server.observed.protectedCalls, mode === 'automatic' ? 1 : 0);
            } finally { release.resolve(); await server.close(); }
        });
    }

    test(`${mode} 갱신 SQL이 실패하면 교체를 롤백하고 기존 토큰이 유효하다`, async () => {
        const fixture = await createAdminUsersFixture();
        const login = await fixture.AdminUsers.login('admin', 'correct-password', '127.0.0.1');
        const token = expiredAccessToken(fixture.AdminUsers, login);
        const originalHash = fixture.sessions[0].refresh_token_hash;
        fixture.hooks.afterQuery = call => { if (isRotation(call)) throw new Error('DB update failed'); };
        const server = await createRefreshServer(fixture);
        try {
            assert.equal((await refresh(server, mode, login, token)).status, 401);
            assert.equal(fixture.sessions[0].refresh_token_hash, originalHash);
            assert.equal(server.observed.protectedCalls, 0);
            assert.deepEqual(server.observed.handlerErrors, []);
            fixture.hooks.afterQuery = null;
            assert.equal((await refresh(server, mode, login, token)).status, 200);
        } finally { await server.close(); }
    });

    test(`${mode} 갱신 도중 연결이 종료되면 기존 토큰을 보존하고 응답을 다시 쓰지 않는다`, { timeout: 10000 }, async () => {
        const fixture = await createAdminUsersFixture();
        const login = await fixture.AdminUsers.login('admin', 'correct-password', '127.0.0.1');
        const token = expiredAccessToken(fixture.AdminUsers, login);
        const originalHash = fixture.sessions[0].refresh_token_hash;
        const reached = deferred();
        const release = deferred();
        let queryCompleted = false;
        fixture.hooks.beforeQuery = async call => {
            if (isRotation(call)) { reached.resolve(); await release.promise; }
        };
        fixture.hooks.afterQuery = call => { if (isRotation(call)) queryCompleted = true; };
        const server = await createRefreshServer(fixture, { timeout: 5000 });
        const controller = new AbortController();
        try {
            const pending = refresh(server, mode, login, token, controller.signal).catch(error => error);
            await reached.promise;
            controller.abort();
            assert.equal((await pending).name, 'AbortError');
            await server.observed.closed.promise;
            release.resolve();
            await waitFor(() => queryCompleted, 2000);
            await nextTurn();
            await nextTurn();
            assert.equal(fixture.sessions[0].refresh_token_hash, originalHash);
            assert.deepEqual(server.observed.lateWrites, []);
            assert.deepEqual(server.observed.handlerErrors, []);
            assert.equal(server.observed.protectedCalls, 0);
            assert.equal((await refresh(server, mode, login, token)).status, 200);
        } finally { release.resolve(); await server.close(); }
    });

    test(`${mode} 동일 refresh 토큰의 동시 HTTP 갱신은 한 요청만 성공한다`, async () => {
        const fixture = await createAdminUsersFixture();
        const login = await fixture.AdminUsers.login('admin', 'correct-password', '127.0.0.1');
        const token = expiredAccessToken(fixture.AdminUsers, login);
        const server = await createRefreshServer(fixture);
        try {
            const responses = await Promise.all([1, 2].map(() => refresh(server, mode, login, token)));
            assert.deepEqual(responses.map(response => response.status).sort(), [200, 401]);
            const succeeded = responses.find(response => response.status === 200);
            const newRefreshToken = mode === 'explicit'
                ? succeeded.body.data.refreshToken : succeeded.headers.get('x-new-refresh-token');
            await fixture.AdminUsers.verifyRefreshSession(newRefreshToken,
                fixture.AdminUsers.verifyRefreshToken(newRefreshToken));
            assert.equal(server.observed.protectedCalls, mode === 'automatic' ? 1 : 0);
            assert.deepEqual(server.observed.handlerErrors, []);
        } finally { await server.close(); }
    });
}
