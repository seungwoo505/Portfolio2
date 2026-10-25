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
    const before = Math.floor(Date.now() / 1000) * 1000;
    await assert.rejects(AdminUsers.login('admin', 'wrong-password', '127.0.0.1'), /비밀번호/);
    assert.equal(adminUser.failed_login_attempts, 5);
    assert.equal(typeof adminUser.locked_until, 'string');
    const lockedUntil = Date.parse(adminUser.locked_until.replace(' ', 'T') + 'Z');
    assert.ok(lockedUntil >= before + 30 * 60 * 1000);
    assert.ok(lockedUntil <= Date.now() + 30 * 60 * 1000);
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

for (const timezone of ['UTC', 'Asia/Seoul', 'America/Los_Angeles']) {
    for (const stage of ['초기 조회', '트랜잭션 재검사']) {
        test(`${timezone}: ${stage}의 DB 잠금 DATETIME 문자열이 유효하면 세션을 발급하지 않는다`, async (t) => {
            const originalTimezone = process.env.TZ;
            process.env.TZ = timezone;
            t.after(() => {
                if (originalTimezone === undefined) delete process.env.TZ;
                else process.env.TZ = originalTimezone;
            });
            const { AdminUsers, adminUser, sessions, hooks, transactionCalls } = await createAdminUsersFixture();
            const lock = () => {
                adminUser.locked_until = new Date(Date.now() + 30 * 60 * 1000)
                    .toISOString().slice(0, 19).replace('T', ' ');
            };
            if (stage === '초기 조회') lock();
            else hooks.afterQuery = call => {
                if (call.sql.includes('(username = ? or email = ?)')) lock();
            };
            await assert.rejects(AdminUsers.login('admin', 'correct-password', '127.0.0.1'), /잠겨/);
            assert.equal(sessions.length, 0);
            assert.ok(adminUser.locked_until);
            if (stage === '트랜잭션 재검사') {
                assert.ok(transactionCalls.some(call => call.event === 'rollback'));
            }
        });
    }
}

for (const lockedUntil of ['2026-10-24 11:59:59', '2026-10-24 12:00:00', null]) {
    test(`DB 현재 시각 기준 만료된 잠금 ${lockedUntil}은 로그인하고 계산 열을 응답에 노출하지 않는다`, async () => {
        const { AdminUsers, adminUser, sessions } = await createAdminUsersFixture({
            databaseNow: () => Date.parse('2026-10-24T12:00:00Z')
        });
        adminUser.locked_until = lockedUntil;
        const result = await AdminUsers.login('admin', 'correct-password', '127.0.0.1');
        assert.ok(result.token);
        assert.equal(sessions.length, 1);
        assert.equal(adminUser.locked_until, null);
        assert.equal(Object.hasOwn(result.user, 'login_is_locked'), false);
    });
}

for (const stage of ['초기 조회', '트랜잭션 재검사']) {
    for (const [value, locked] of [[null, false], [0, false], ['0', false], [false, false], [1, true], ['1', true], [true, true]]) {
        test(`${stage}: DB 잠금 계산값 ${typeof value}:${String(value)}은 ${locked ? '세션 발급을 거부한다' : '로그인을 허용한다'}`, async () => {
            const { AdminUsers, sessions, transactionCalls } = await createAdminUsersFixture({
                hooks: {
                    afterQuery(call, result) {
                        const isTarget = stage === '초기 조회'
                            ? call.sql.includes('(username = ? or email = ?)')
                            : call.sql.includes('from admin_users') && call.sql.includes('for update');
                        if (isTarget) result[0].login_is_locked = value;
                    }
                }
            });
            const login = () => AdminUsers.login('admin', 'correct-password', '127.0.0.1');
            if (locked) {
                await assert.rejects(login(), /잠겨/);
                assert.equal(sessions.length, 0);
                if (stage === '트랜잭션 재검사') {
                    assert.ok(transactionCalls.some(call => call.event === 'rollback'));
                } else {
                    assert.equal(transactionCalls.length, 0);
                }
            } else {
                const result = await login();
                assert.ok(result.token);
                assert.equal(sessions.length, 1);
                assert.equal(Object.hasOwn(result.user, 'login_is_locked'), false);
            }
        });
    }
}
