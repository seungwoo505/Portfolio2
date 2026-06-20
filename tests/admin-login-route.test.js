const test = require('node:test');
const assert = require('node:assert/strict');
const {
    loadAuthRoute,
    requestJson
} = require('./helpers/admin-auth-route-loader');

test('admin login rejects blank credentials before model call', async () => {
    let loginCalled = false;
    const router = loadAuthRoute({
        AdminUsers: {
            login: async () => {
                loginCalled = true;
            }
        }
    });

    const { status, body } = await requestJson(router, '/login', {
        method: 'POST',
        body: {
            username: '   ',
            password: 'secret'
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, '사용자명과 비밀번호를 입력해주세요.');
    assert.equal(loginCalled, false);
});

test('admin login returns a generic failure message', async () => {
    const logCalls = [];
    const router = loadAuthRoute({
        AdminUsers: {
            login: async () => {
                throw new Error('사용자를 찾을 수 없습니다.');
            }
        },
        AdminActivityLogs: {
            log: async (...args) => {
                logCalls.push(args);
            }
        }
    });

    const { status, body } = await requestJson(router, '/login', {
        method: 'POST',
        body: {
            username: 'admin',
            password: 'wrong-password'
        }
    });

    assert.equal(status, 401);
    assert.equal(body.message, '사용자명 또는 비밀번호가 올바르지 않습니다.');
    assert.equal(logCalls.length, 1);
});

test('admin login succeeds even when activity logging fails', async () => {
    const router = loadAuthRoute({
        AdminUsers: {
            login: async () => ({
                user: {
                    id: 1,
                    username: 'admin'
                },
                token: 'access-token',
                refreshToken: 'refresh-token'
            }),
            getUserPermissions: async () => [
                { name: 'dashboard.read', resource: 'dashboard', action: 'read' }
            ]
        },
        AdminActivityLogs: {
            log: async () => {
                throw new Error('activity log database unavailable');
            }
        }
    });

    const { status, body } = await requestJson(router, '/login', {
        method: 'POST',
        body: {
            username: 'admin',
            password: 'correct-password'
        }
    });

    assert.equal(status, 200);
    assert.equal(body.message, '로그인되었습니다.');
    assert.equal(body.data.token, 'access-token');
    assert.deepEqual(body.data.permissions, [
        { name: 'dashboard.read', resource: 'dashboard', action: 'read' }
    ]);
});

test('admin login failure still returns 401 when activity logging fails', async () => {
    const router = loadAuthRoute({
        AdminUsers: {
            login: async () => {
                throw new Error('비밀번호가 올바르지 않습니다.');
            }
        },
        AdminActivityLogs: {
            log: async () => {
                throw new Error('activity log database unavailable');
            }
        }
    });

    const { status, body } = await requestJson(router, '/login', {
        method: 'POST',
        body: {
            username: 'admin',
            password: 'wrong-password'
        }
    });

    assert.equal(status, 401);
    assert.equal(body.message, '사용자명 또는 비밀번호가 올바르지 않습니다.');
});
