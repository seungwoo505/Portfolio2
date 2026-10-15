const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const {
    createAdminUsersFixture,
    createResponse,
    loadAuthMiddleware
} = require('./helpers/admin-auth-fixture');

const oldPassword = 'correct-password';
const newPassword = 'NewStrongPass123';
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};
const outcome = promise => promise.then(value => ({ value }), error => ({ error }));
const authenticate = async (AdminUsers, token) => {
    const { authenticateToken } = loadAuthMiddleware(AdminUsers);
    const res = createResponse();
    let accepted = false;
    await authenticateToken({
        headers: { authorization: `Bearer ${token}` },
        ip: '127.0.0.1'
    }, res, () => { accepted = true; });
    return { accepted, status: res.statusCode };
};
const assertReleasedTransactions = (calls) => {
    const ids = calls.filter(call => call.event === 'begin').map(call => call.connectionId);
    assert.ok(ids.length > 0, 'DB 트랜잭션을 사용해야 한다');
    for (const id of ids) {
        const events = calls.filter(call => call.connectionId === id).map(call => call.event);
        assert.equal(events.filter(event => event === 'release').length, 1);
        assert.equal(events.filter(event => event === 'commit' || event === 'rollback').length, 1);
    }
};
const changes = {
    '관리자 비밀번호 초기화': (model) => model.update(1, { password: newPassword }),
    '현재 세션을 보존하는 비밀번호 변경': (model, sessionId) => (
        model.changePassword(1, oldPassword, newPassword, sessionId)
    )
};

for (const [label, change] of Object.entries(changes)) {
    test(`${label} 완료 후 이전 비밀번호 검증으로 새 세션을 발급하지 않는다`, { timeout: 5000 }, async (t) => {
        const { AdminUsers, sessions, transactionCalls } = await createAdminUsersFixture();
        const current = await AdminUsers.login('admin', oldPassword, '127.0.0.1');
        const currentSid = AdminUsers.verifyToken(current.token).sid;
        const verified = deferred();
        const resume = deferred();
        const compare = bcrypt.compare;
        let pauseNext = true;
        bcrypt.compare = async (...args) => {
            const valid = await compare(...args);
            if (pauseNext) {
                pauseNext = false;
                verified.resolve();
                await resume.promise;
            }
            return valid;
        };
        t.after(() => { bcrypt.compare = compare; resume.resolve(); });

        const pending = outcome(AdminUsers.login('admin', oldPassword, '127.0.0.1'));
        await verified.promise;
        try {
            // 다른 프로세스의 모델 인스턴스처럼 상태를 공유하지 않는 호출자.
            await change({ ...AdminUsers }, currentSid);
        } finally {
            resume.resolve();
        }
        const result = await pending;
        if (result.value) {
            assert.equal((await authenticate(AdminUsers, result.value.token)).accepted, false,
                '교체 전 비밀번호로 검증된 요청의 토큰이 실제 인증을 통과해서는 안 된다');
        }
        assert.match(result.error?.message || '', /비밀번호/);
        assert.equal(sessions.filter(session => !session.revoked_at).length,
            label.includes('현재 세션') ? 1 : 0);
        assert.equal((await authenticate(AdminUsers, current.token)).accepted, label.includes('현재 세션'));
        await assert.rejects(AdminUsers.login('admin', oldPassword, '127.0.0.1'), /비밀번호/);
        const fresh = await AdminUsers.login('admin', newPassword, '127.0.0.1');
        assert.equal((await authenticate(AdminUsers, fresh.token)).accepted, true);
        assertReleasedTransactions(transactionCalls);
    });

    test(`${label} 시 진행 중인 로그인 세션 저장을 기다린 뒤 해당 세션도 회수한다`, { timeout: 5000 }, async () => {
        const { AdminUsers, hooks, queryCalls, transactionCalls } = await createAdminUsersFixture();
        const current = await AdminUsers.login('admin', oldPassword, '127.0.0.1');
        const currentSid = AdminUsers.verifyToken(current.token).sid;
        const inserting = deferred();
        const resume = deferred();
        const waiting = deferred();
        hooks.beforeQuery = async call => {
            if (call.sql.startsWith('insert into admin_sessions')) {
                inserting.resolve();
                await resume.promise;
            }
        };
        hooks.onLockWait = () => waiting.resolve('locked');
        const pendingLogin = outcome(AdminUsers.login('admin', oldPassword, '127.0.0.1'));
        await inserting.promise;
        const pendingChange = outcome(change({ ...AdminUsers }, currentSid));
        try {
            // 수정 전에는 비밀번호 교체가 먼저 끝나고, 수정 후에는 DB 행 잠금에서 대기한다.
            await Promise.race([waiting.promise, pendingChange]);
        } finally {
            resume.resolve();
        }
        const [loginResult, changeResult] = await Promise.all([pendingLogin, pendingChange]);
        assert.ifError(loginResult.error);
        assert.ifError(changeResult.error);
        assert.equal((await authenticate(AdminUsers, loginResult.value.token)).accepted, false,
            '세션 INSERT를 기다리던 이전 비밀번호 로그인도 교체 완료 후 인증을 통과해서는 안 된다');
        assert.equal((await authenticate(AdminUsers, current.token)).accepted, label.includes('현재 세션'));

        const insert = queryCalls.filter(call => call.sql.startsWith('insert into admin_sessions')).at(-1);
        const passwordUpdate = queryCalls.find(call => call.sql.startsWith('update admin_users')
            && call.sql.includes('password_hash = ?'));
        assert.ok(insert.connectionId);
        assert.ok(passwordUpdate.connectionId);
        assert.notEqual(insert.connectionId, passwordUpdate.connectionId);
        for (const connectionId of [insert.connectionId, passwordUpdate.connectionId]) {
            assert.ok(queryCalls.some(call => call.connectionId === connectionId
                && call.sql.includes('from admin_users') && call.sql.includes('for update')));
        }
        const revoke = queryCalls.find(call => call.sql.startsWith('update admin_sessions')
            && call.sql.includes('admin_id = ?'));
        assert.equal(revoke.connectionId, passwordUpdate.connectionId);
        assertReleasedTransactions(transactionCalls);
    });

    test(`${label} 중 세션 회수가 실패하면 비밀번호도 롤백하고 연결을 반환한다`, { timeout: 5000 }, async () => {
        const { AdminUsers, hooks, adminUser, sessions, transactionCalls } = await createAdminUsersFixture();
        const current = await AdminUsers.login('admin', oldPassword, '127.0.0.1');
        const currentSid = AdminUsers.verifyToken(current.token).sid;
        const originalHash = adminUser.password_hash;
        hooks.beforeQuery = call => {
            if (call.sql.startsWith('update admin_sessions') && call.sql.includes('admin_id = ?')) {
                throw new Error('세션 회수 DB 오류');
            }
        };
        await assert.rejects(change(AdminUsers, currentSid), /세션 회수 DB 오류/);
        assert.equal(adminUser.password_hash, originalHash);
        assert.equal(sessions[0].revoked_at, null);
        assert.equal((await authenticate(AdminUsers, current.token)).accepted, true);
        assert.ok(transactionCalls.some(call => call.event === 'rollback'));
        assertReleasedTransactions(transactionCalls);
        hooks.beforeQuery = null;
        await change(AdminUsers, currentSid);
        assert.equal(await bcrypt.compare(newPassword, adminUser.password_hash), true);
    });
}

test('세션 INSERT 실패 시 로그인 후처리를 롤백하고 다음 로그인이 잠금 없이 진행된다', { timeout: 5000 }, async () => {
    const { AdminUsers, adminUser, sessions, hooks, transactionCalls } = await createAdminUsersFixture();
    adminUser.failed_login_attempts = 3;
    hooks.beforeQuery = call => {
        if (call.sql.startsWith('insert into admin_sessions')) throw new Error('세션 저장 DB 오류');
    };
    await assert.rejects(AdminUsers.login('admin', oldPassword, '127.0.0.1'), /세션 저장 DB 오류/);
    assert.equal(adminUser.failed_login_attempts, 3);
    assert.equal(sessions.length, 0);
    assert.ok(transactionCalls.some(call => call.event === 'rollback'));
    assertReleasedTransactions(transactionCalls);
    hooks.beforeQuery = null;
    const login = await AdminUsers.login('admin', oldPassword, '127.0.0.1');
    assert.equal((await authenticate(AdminUsers, login.token)).accepted, true);
});

for (const state of ['비활성', '잠금']) {
    test(`로그인 검증 중 계정이 ${state} 상태가 되면 세션을 발급하지 않는다`, { timeout: 5000 }, async () => {
        const { AdminUsers, adminUser, sessions, hooks } = await createAdminUsersFixture();
        hooks.afterQuery = call => {
            if (call.sql.includes('(username = ? or email = ?)')) {
                if (state === '비활성') adminUser.is_active = 0;
                else adminUser.locked_until = new Date(Date.now() + 60000);
            }
        };
        await assert.rejects(AdminUsers.login('admin', oldPassword, '127.0.0.1'), /사용자|잠금|잠겨/);
        assert.equal(sessions.length, 0);
    });
}

test('비밀번호 변경도 검증 후 다른 비밀번호 교체가 완료되면 이전 해시로 덮어쓰지 않는다', { timeout: 5000 }, async (t) => {
    const { AdminUsers, adminUser } = await createAdminUsersFixture();
    const verified = deferred();
    const resume = deferred();
    const compare = bcrypt.compare;
    let pauseNext = true;
    bcrypt.compare = async (...args) => {
        const valid = await compare(...args);
        if (pauseNext) {
            pauseNext = false;
            verified.resolve();
            await resume.promise;
        }
        return valid;
    };
    t.after(() => { bcrypt.compare = compare; resume.resolve(); });
    const pending = outcome(AdminUsers.changePassword(1, oldPassword, 'ObsoletePassword123'));
    await verified.promise;
    try {
        await AdminUsers.update(1, { password: newPassword });
    } finally {
        resume.resolve();
    }
    const result = await pending;
    assert.match(result.error?.message || '', /기존 비밀번호/);
    assert.equal(await compare(newPassword, adminUser.password_hash), true);
});
