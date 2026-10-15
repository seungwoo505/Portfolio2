const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdminUsersFixture } = require('./helpers/admin-auth-fixture');

test('잘못된 비밀번호는 네 번까지 계정을 잠그지 않고 다섯 번째에 30분 잠근다', async () => {
    const { AdminUsers, adminUser, sessions } = await createAdminUsersFixture();
    for (const attempts of [1, 2, 3, 4]) {
        await assert.rejects(AdminUsers.login('admin', 'wrong-password', '127.0.0.1'), /비밀번호/);
        assert.equal(adminUser.failed_login_attempts, attempts);
        assert.equal(adminUser.locked_until, null, `${attempts}번째 실패에 잠기면 안 된다`);
    }
    const before = Date.now();
    await assert.rejects(AdminUsers.login('admin', 'wrong-password', '127.0.0.1'), /비밀번호/);
    assert.equal(adminUser.failed_login_attempts, 5);
    assert.ok(adminUser.locked_until >= new Date(before + 30 * 60 * 1000));
    assert.ok(adminUser.locked_until <= new Date(Date.now() + 30 * 60 * 1000));
    await assert.rejects(AdminUsers.login('admin', 'correct-password', '127.0.0.1'), /잠겨/);
    assert.equal(adminUser.failed_login_attempts, 5);
    assert.equal(sessions.length, 0);
});

test('네 번 실패 후 올바른 비밀번호는 로그인하고 실패 횟수를 초기화한다', async () => {
    const { AdminUsers, adminUser, sessions } = await createAdminUsersFixture();
    for (let index = 0; index < 4; index++) {
        await assert.rejects(AdminUsers.login('admin', 'wrong-password', '127.0.0.1'), /비밀번호/);
    }
    const result = await AdminUsers.login('admin', 'correct-password', '127.0.0.1');
    assert.ok(result.token);
    assert.equal(adminUser.failed_login_attempts, 0);
    assert.equal(adminUser.locked_until, null);
    assert.equal(sessions.length, 1);
    await assert.rejects(AdminUsers.login('admin', 'wrong-password', '127.0.0.1'), /비밀번호/);
    assert.equal(adminUser.failed_login_attempts, 1);
    assert.equal(adminUser.locked_until, null);
});
