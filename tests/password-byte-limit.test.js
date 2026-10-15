const test = require('node:test');
const assert = require('node:assert/strict');
const { getPasswordPolicyError } = require('../utils/admin-validation.ts');
const { createAdminUsersFixture } = require('./helpers/admin-auth-fixture');
const { loadAuthRoute, requestJson } = require('./helpers/admin-auth-route-loader');

const prefix = 'A1' + 'x'.repeat(70);

test('비밀번호 정책은 문자 수 대신 UTF-8 72바이트 경계를 검사한다', () => {
    assert.equal(getPasswordPolicyError(prefix), null);
    assert.equal(getPasswordPolicyError('A1' + '한'.repeat(23) + 'x'), null);
    for (const password of [prefix + 'x', 'A1' + '한'.repeat(24)]) {
        assert.match(getPasswordPolicyError(password) || '', /72바이트/);
    }
});

test('72바이트 뒤에 다른 문자를 붙인 비밀번호로 로그인할 수 없다', async () => {
    const { AdminUsers, sessions } = await createAdminUsersFixture({ password: prefix });
    await assert.rejects(AdminUsers.login('admin', prefix + 'different', '127.0.0.1'), /비밀번호/);
    assert.equal(sessions.length, 0);
    assert.ok((await AdminUsers.login('admin', prefix, '127.0.0.1', 'agent')).token);
});

test('모델의 모든 비밀번호 저장 경로가 72바이트 초과를 거절한다', async () => {
    const { AdminUsers, queryCalls } = await createAdminUsersFixture();
    const longPassword = prefix + 'tail';
    await assert.rejects(AdminUsers.create({ username: 'new', email: 'new@example.com', password: longPassword }), /72바이트/);
    await assert.rejects(AdminUsers.update(1, { password: longPassword }), /72바이트/);
    await assert.rejects(AdminUsers.changePassword(1, 'correct-password', longPassword), /72바이트/);
    assert.equal(queryCalls.some(call => /^(insert|update)/.test(call.sql)), false);
});

test('기존 비밀번호 확인에서도 잘리는 접미사를 허용하지 않는다', async () => {
    const { AdminUsers, queryCalls } = await createAdminUsersFixture({ password: prefix });
    await assert.rejects(AdminUsers.changePassword(1, prefix + 'tail', 'NewStrongPass123'), /기존 비밀번호/);
    assert.equal(queryCalls.some(call => call.sql.startsWith('update')), false);
});

test('비밀번호 변경 API는 긴 비밀번호를 400으로 거절한다', async () => {
    let called = false;
    const router = loadAuthRoute({ AdminUsers: { changePassword: async () => { called = true; } } });
    const response = await requestJson(router, '/password', {
        method: 'PUT', body: { oldPassword: 'old-password', newPassword: prefix + 'tail' }
    });
    assert.equal(response.status, 400);
    assert.match(response.body.message, /72바이트/);
    assert.equal(called, false);
});
