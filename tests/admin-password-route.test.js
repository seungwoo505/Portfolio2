const test = require('node:test');
const assert = require('node:assert/strict');
const {
    loadAuthRoute,
    requestJson
} = require('./helpers/admin-auth-route-loader');

test('admin password change rejects weak new passwords before model call', async () => {
    let changePasswordCalled = false;
    const router = loadAuthRoute({
        AdminUsers: {
            changePassword: async () => {
                changePasswordCalled = true;
            }
        }
    });

    const { status, body } = await requestJson(router, '/password', {
        method: 'PUT',
        body: {
            oldPassword: 'old-password',
            newPassword: 'short'
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, '비밀번호는 최소 12자 이상이어야 합니다.');
    assert.equal(changePasswordCalled, false);
});

test('admin password change preserves expected password errors', async () => {
    const router = loadAuthRoute({
        AdminUsers: {
            changePassword: async () => {
                throw new Error('기존 비밀번호가 올바르지 않습니다.');
            }
        }
    });

    const { status, body } = await requestJson(router, '/password', {
        method: 'PUT',
        body: {
            oldPassword: 'WrongStrongPass!2026',
            newPassword: 'NewStrongPass!2026'
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, '기존 비밀번호가 올바르지 않습니다.');
});

test('admin password change hides unexpected internal errors', async () => {
    const router = loadAuthRoute({
        AdminUsers: {
            changePassword: async () => {
                throw new Error('database password hash leaked');
            }
        }
    });

    const { status, body } = await requestJson(router, '/password', {
        method: 'PUT',
        body: {
            oldPassword: 'CurrentStrongPass!2026',
            newPassword: 'NewStrongPass!2026'
        }
    });

    assert.equal(status, 500);
    assert.equal(body.message, '비밀번호 변경 중 오류가 발생했습니다.');
    assert.equal(Object.prototype.hasOwnProperty.call(body, 'error'), false);
});
