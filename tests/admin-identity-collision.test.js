const test = require('node:test');
const assert = require('node:assert/strict');
const { createAdminIdentityFixture } = require('./helpers/admin-identity-fixture');
const { loadUsersRoute, requestJson } = require('./helpers/admin-auth-route-loader');

const duplicateMessage = '이미 존재하는 사용자명 또는 이메일입니다.';
const account = (username, email) => ({ username, email, password: 'StrongPass123' });
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};
const outcome = promise => promise.then(value => ({ value }), error => ({ error }));

for (const [label, data] of [
    ['사용자명과 기존 이메일', account('shared@example.com', 'new@example.com')],
    ['이메일과 기존 사용자명', account('new', 'alice')],
    ['대소문자 차이', account('SHARED@example.com', 'new@example.com')],
    ['악센트 차이', account('sharéd@example.com', 'new@example.com')]
]) {
    test(`관리자 생성은 ${label}의 충돌을 거절한다`, async () => {
        const { AdminUsers, users } = await createAdminIdentityFixture();
        await assert.rejects(AdminUsers.create(data), { message: duplicateMessage });
        assert.equal(users.length, 2);
    });
}

for (const data of [{ username: 'shared@example.com' }, { email: 'alice' }]) {
    test(`관리자 ${Object.keys(data)[0]} 수정은 다른 계정의 반대 식별자와 충돌할 수 없다`, async () => {
        const { AdminUsers, users } = await createAdminIdentityFixture();
        await assert.rejects(AdminUsers.update(2, data), { message: duplicateMessage });
        assert.equal(users[1].username, 'bob');
        assert.equal(users[1].email, 'bob@example.com');
    });
}

test('자기 사용자명과 이메일을 같게 저장하거나 @가 포함된 사용자명을 쓸 수 있다', async () => {
    const { AdminUsers, users } = await createAdminIdentityFixture();
    const id = await AdminUsers.create(account('same@example.com', 'same@example.com'));
    await AdminUsers.update(id, { full_name: '같은 식별자', username: 'same@example.com' });
    await AdminUsers.update(2, { username: 'bob@example.com' });
    assert.equal(users.find(user => user.id === id).email, 'same@example.com');
    assert.equal(users[1].username, 'bob@example.com');
});

const concurrentWrites = {
    '생성과 생성': model => [
        () => model.create(account('first', 'occupied@example.com')),
        () => ({ ...model }).create(account('occupied@example.com', 'second@example.com'))
    ],
    '생성과 수정': model => [
        () => model.create(account('first', 'occupied@example.com')),
        () => ({ ...model }).update(2, { username: 'occupied@example.com' })
    ],
    '수정과 생성': model => [
        () => model.update(1, { email: 'occupied@example.com' }),
        () => ({ ...model }).create(account('occupied@example.com', 'second@example.com'))
    ],
    '수정과 수정': model => [
        () => model.update(1, { email: 'occupied@example.com' }),
        () => ({ ...model }).update(2, { username: 'occupied@example.com' })
    ]
};
for (const [label, makeWrites] of Object.entries(concurrentWrites)) {
    test(`동시 ${label}도 한 계정만 같은 로그인 식별자를 차지한다`, { timeout: 5000 }, async () => {
        const { AdminUsers, users, hooks } = await createAdminIdentityFixture();
        const checked = deferred();
        const resume = deferred();
        const waiting = deferred();
        let pauseNext = true;
        hooks.afterQuery = async call => {
            if (pauseNext && call.sql.startsWith('select id from admin_users')) {
                pauseNext = false;
                checked.resolve();
                await resume.promise;
            }
        };
        hooks.onLockWait = () => waiting.resolve();
        const [first, second] = makeWrites(AdminUsers);
        const firstResult = outcome(first());
        // 수정 전의 UPDATE는 중복 조회를 하지 않으므로 바로 완료한다.
        await Promise.race([checked.promise, firstResult]);
        if (pauseNext) pauseNext = false;
        const secondResult = outcome(second());
        try { await Promise.race([waiting.promise, secondResult]); }
        finally { resume.resolve(); }
        const results = await Promise.all([firstResult, secondResult]);
        assert.equal(results.filter(result => !result.error).length, 1);
        assert.equal(results.find(result => result.error)?.error.message, duplicateMessage);
        assert.equal(users.filter(user => user.username === 'occupied@example.com'
            || user.email === 'occupied@example.com').length, 1);
    });
}

test('관리자 수정 API도 식별자 중복을 기존 생성 API와 같은 400으로 반환한다', async () => {
    const router = loadUsersRoute({
        getById: async id => ({ id }),
        update: async () => { throw new Error(duplicateMessage); }
    });
    const response = await requestJson(router, '/users/2', {
        method: 'PUT', body: { username: 'shared@example.com' }
    });
    assert.equal(response.status, 400);
    assert.equal(response.body.message, duplicateMessage);
});

test('식별자 검사와 쓰기는 같은 트랜잭션 연결을 쓰고 커밋 후 잠금을 해제한다', async () => {
    const { AdminUsers, calls } = await createAdminIdentityFixture();
    await AdminUsers.create(account('new', 'new@example.com'));
    const queries = calls.filter(call => call.sql);
    assert.ok(queries[0].connectionId, '식별자 쓰기는 전용 DB 연결을 사용해야 한다');
    assert.ok(queries.every(call => call.connectionId === queries[0].connectionId), '모든 SQL은 같은 연결을 사용해야 한다');
    assert.ok(calls.findIndex(call => call.event === 'commit')
        < calls.findIndex(call => call.sql?.includes('release_lock(')), '커밋을 마친 뒤 잠금을 해제해야 한다');
    assert.equal(calls.at(-1).event, 'release');
});

for (const failure of ['쓰기', '세션 회수']) {
    test(`${failure} 실패 시 식별자 수정을 롤백하고 잠금을 해제한다`, async () => {
        const { AdminUsers, users, hooks, calls } = await createAdminIdentityFixture();
        hooks.beforeQuery = call => {
            if (call.sql.startsWith(failure === '쓰기' ? 'update admin_users' : 'update admin_sessions')) {
                throw new Error('저장 실패');
            }
        };
        await assert.rejects(AdminUsers.update(2, {
            username: 'changed', password: 'NewStrongPass123'
        }), /저장 실패/);
        assert.equal(users[1].username, 'bob');
        assert.ok(calls.some(call => call.event === 'rollback'), '실패한 변경은 롤백해야 한다');
        assert.ok(calls.some(call => call.sql?.includes('release_lock(')), '실패 후 DB 잠금도 해제해야 한다');
        assert.equal(calls.at(-1).event, 'release');
        hooks.beforeQuery = null;
        await AdminUsers.update(2, { username: 'changed' });
        assert.equal(users[1].username, 'changed');
    });
}

for (const failure of ['획득 응답 유실', '해제 오류', '롤백 오류']) {
    test(`DB 잠금 ${failure} 연결은 풀에 돌려주지 않고 폐기한다`, async () => {
        const { AdminUsers, users, hooks, calls } = await createAdminIdentityFixture();
        hooks.beforeQuery = call => {
            if (failure === '해제 오류' && call.sql.includes('release_lock(')) throw new Error('해제 오류');
            if (failure === '롤백 오류' && call.sql.startsWith('insert into')) throw new Error('원래 저장 오류');
        };
        hooks.afterQuery = call => {
            if (failure === '획득 응답 유실' && call.sql.includes('get_lock(')) throw new Error('잠금 오류');
        };
        hooks.beforeEvent = event => {
            if (failure === '롤백 오류' && event === 'rollback') throw new Error('롤백 오류');
        };
        const pending = AdminUsers.create(account('new', 'new@example.com'));
        if (failure === '해제 오류') await pending;
        else await assert.rejects(pending, failure === '롤백 오류' ? /원래 저장 오류/ : /잠금 오류/);
        assert.equal(calls.at(-1).event, 'destroy');
        assert.equal(calls.some(call => call.event === 'release'), false);
        if (failure !== '해제 오류') assert.equal(users.length, 2);
    });
}

for (const result of [0, null]) {
    test(`DB 잠금 획득 결과가 ${result}이면 관리자 생성을 실행하지 않는다`, async () => {
        const { AdminUsers, users, hooks, calls } = await createAdminIdentityFixture();
        hooks.getLockResult = result;
        await assert.rejects(AdminUsers.create(account('new', 'new@example.com')), /잠금/);
        assert.equal(users.length, 2);
        assert.equal(calls.some(call => call.event === 'begin'), false);
        assert.equal(calls.at(-1).event, result === 0 ? 'release' : 'destroy');
    });

    test(`DB 잠금 해제 결과가 ${result}이면 연결을 폐기한다`, async () => {
        const { AdminUsers, hooks, calls } = await createAdminIdentityFixture();
        hooks.releaseLockResult = result;
        await AdminUsers.create(account('new', 'new@example.com'));
        assert.equal(calls.at(-1).event, 'destroy');
        assert.equal(calls.some(call => call.event === 'release'), false);
    });
}

for (const failure of ['begin', 'commit']) {
    test(`트랜잭션 ${failure} 실패 시 원래 오류를 유지하고 롤백한 뒤 잠금을 해제한다`, async () => {
        const { AdminUsers, users, hooks, calls } = await createAdminIdentityFixture();
        hooks.beforeEvent = event => {
            if (event === failure) throw new Error(`${failure} 오류`);
        };
        await assert.rejects(AdminUsers.create(account('new', 'new@example.com')), new RegExp(`${failure} 오류`));
        assert.equal(users.length, 2);
        assert.ok(calls.some(call => call.event === 'rollback'), '트랜잭션 실패 후 롤백해야 한다');
        assert.ok(calls.some(call => call.sql?.includes('release_lock(')), 'DB 잠금도 해제해야 한다');
        assert.equal(calls.at(-1).event, 'release');
    });
}
