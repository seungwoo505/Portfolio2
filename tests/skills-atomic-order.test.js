const test = require('node:test');
const assert = require('node:assert/strict');
const { createSkillsDatabase } = require('./helpers/skills-model-fixture');
const { loadSkillsRoute, requestJson } = require('./helpers/skills-route-loader');

const skill = (id, is_featured, display_order) => ({ id, name: `기술 ${id}`, category_id: 1,
    proficiency_level: 50, years_of_experience: null, icon: null, color: null, is_featured, display_order });
const createPayload = name => ({ name, category_id: 1, is_featured: true, display_order: 7 });
const assertNoLockLeaks = database => {
    assert.equal([...database.locks.values()].every(lock => !lock.owner), true);
    assert.equal(database.connections.every(connection => connection.released || connection.destroyed), true);
};
const assertOneFeaturedOrder = database => {
    assert.equal([...database.rows.values()].filter(row => Number(row.is_featured) === 1
        && Number(row.display_order) === 7).length, 1);
};

for (const scenario of [
    { name: '생성', method: 'POST', rows: [], path: () => '/skills',
        body: id => createPayload(`기술 ${id}`), success: 201 },
    { name: 'PUT', method: 'PUT', rows: [skill(1, 0, 0), skill(2, 0, 0)],
        path: id => `/skills/${id}`, body: () => ({ is_featured: true, display_order: 7 }), success: 200 },
    { name: '추천 변경', method: 'PATCH', rows: [skill(1, 0, 7), skill(2, 0, 7)],
        path: id => `/skills/${id}/featured`, body: () => ({ is_featured: true }), success: 200 },
    { name: '순서 변경', method: 'PATCH', rows: [skill(1, 1, 0), skill(2, 1, 0)],
        path: id => `/skills/${id}/order`, body: () => ({ display_order: 7 }), success: 200 }
]) {
    test(`서로 다른 모델의 동시 ${scenario.name}은 추천 양수 순서를 한 번만 저장한다`, { timeout: 5000 }, async () => {
        const database = createSkillsDatabase({ rows: scenario.rows, gate: 'conflict' });
        const first = loadSkillsRoute(database.makeModel());
        const second = loadSkillsRoute(database.makeModel());
        const results = await Promise.all([first, second].map((router, index) => requestJson(router,
            scenario.path(index + 1), { method: scenario.method, body: scenario.body(index + 1) })));

        assert.equal(database.gateCount, 2, '두 라우트 선조회가 모두 빈 결과를 확인한 뒤 쓰기를 시작한다');
        assert.deepEqual(results.map(result => result.status).sort(), [scenario.success, 400].sort());
        assert.equal(results.find(result => result.status === 400).body.message,
            '표시 순서 7은(는) 이미 사용 중입니다. 다른 순서를 선택해주세요.');
        assert.equal(database.writes, 1);
        assertOneFeaturedOrder(database);
        const lockCalls = database.calls.filter(call => call.sql.includes('get_lock('));
        assert.equal(lockCalls.length, 2);
        assert.notEqual(lockCalls[0].connection, lockCalls[1].connection);
        assertNoLockLeaks(database);
    });
}

test('같은 스킬의 추천 변경과 순서 변경도 잠금 안에서 최신 상태를 검사한다', { timeout: 5000 }, async () => {
    const database = createSkillsDatabase({ rows: [skill(1, 0, 0), skill(2, 1, 7)], gate: 'existing' });
    const first = loadSkillsRoute(database.makeModel());
    const second = loadSkillsRoute(database.makeModel());
    const results = await Promise.all([
        requestJson(first, '/skills/1/featured', { method: 'PATCH', body: { is_featured: true } }),
        requestJson(second, '/skills/1/order', { method: 'PATCH', body: { display_order: 7 } })
    ]);

    assert.deepEqual(results.map(result => result.status).sort(), [200, 400]);
    assertOneFeaturedOrder(database);
    assertNoLockLeaks(database);
});

test('모델 직접 호출도 추천 순서 충돌을 거절한다', { timeout: 5000 }, async () => {
    const database = createSkillsDatabase({ rows: [skill(1, 1, 0), skill(2, 1, 0)] });
    const first = database.makeModel();
    const second = database.makeModel();
    const results = await Promise.allSettled([
        first.updateSkill(1, { display_order: 7 }), second.updateSkill(2, { display_order: 7 })
    ]);

    assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(results.find(result => result.status === 'rejected').reason.code, 'SKILL_DISPLAY_ORDER_CONFLICT');
    assertOneFeaturedOrder(database);
    assertNoLockLeaks(database);
});

test('0 순서와 비추천 스킬의 양수 순서는 생성 및 수정에서 중복을 허용한다', async () => {
    const database = createSkillsDatabase();
    const router = loadSkillsRoute(database.makeModel());
    for (const [is_featured, display_order] of [[true, 0], [false, 7]]) {
        for (let index = 0; index < 2; index += 1) {
            const result = await requestJson(router, '/skills', { method: 'POST',
                body: { name: '중복 허용 기술', category_id: 1, is_featured, display_order } });
            assert.equal(result.status, 201);
            assert.equal((await requestJson(router, `/skills/${result.body.data.id}`, {
                method: 'PUT', body: { is_featured, display_order }
            })).status, 200);
        }
    }
    assert.equal(database.rows.size, 4);
    assertNoLockLeaks(database);
});

for (const lockResult of [0, '0', null]) {
    test(`DB 잠금 획득 결과 ${JSON.stringify(lockResult)}은 저장 없이 실패한다`, async () => {
        const database = createSkillsDatabase({ lockResult });
        const result = await requestJson(loadSkillsRoute(database.makeModel()), '/skills', {
            method: 'POST', body: createPayload('잠금 실패')
        });
        assert.equal(result.status, 500);
        assert.equal(database.writes, 0);
        assertNoLockLeaks(database);
    });
}

test('잠금 획득 응답이 유실되면 커넥션을 폐기하여 잠금을 남기지 않는다', async () => {
    const database = createSkillsDatabase({ acquireFailure: true });
    const result = await requestJson(loadSkillsRoute(database.makeModel()), '/skills', {
        method: 'POST', body: createPayload('응답 유실')
    });
    assert.equal(result.status, 500);
    assert.equal(database.writes, 0);
    assert.equal(database.connections.some(connection => connection.destroyed), true);
    assertNoLockLeaks(database);
});

for (const failQuery of ['insert into skills', 'update skills', 'select * from skills']) {
    test(`${failQuery} 쿼리 실패 후 잠금을 해제하고 다음 저장이 성공한다`, async () => {
        const database = createSkillsDatabase({ rows: [skill(1, 1, 0)], failQuery });
        const router = loadSkillsRoute(database.makeModel());
        const create = failQuery === 'insert into skills';
        const request = () => requestJson(router, create ? '/skills' : '/skills/1/order', {
            method: create ? 'POST' : 'PATCH', body: create ? createPayload('저장 실패') : { display_order: 7 }
        });
        assert.equal((await request()).status, 500);
        assert.equal(database.writes, 0);
        assert.equal(database.calls.filter(call => call.sql.includes('get_lock(')).length, 1);
        assert.equal(database.calls.filter(call => call.sql.includes('release_lock(')).length, 1);
        assertNoLockLeaks(database);
        assert.equal((await request()).status, create ? 201 : 200);
        assertOneFeaturedOrder(database);
        assertNoLockLeaks(database);
    });
}

test('잠금 안의 충돌 조회 실패도 저장하지 않고 잠금을 해제한다', async () => {
    const database = createSkillsDatabase({ failQuery: 'display_order = ?' });
    const model = database.makeModel();
    await assert.rejects(model.createSkill(createPayload('검사 실패')), /스킬 쿼리 실패/);
    assert.equal(database.writes, 0);
    assert.equal(database.calls.filter(call => call.sql.includes('release_lock(')).length, 1);
    assertNoLockLeaks(database);
    assert.equal(await model.createSkill(createPayload('재시도')), 1);
    assertOneFeaturedOrder(database);
    assertNoLockLeaks(database);
});

for (const release of [{ releaseFailure: true }, { releaseResult: 0 }, { releaseResult: null }]) {
    test(`잠금 해제 실패 ${JSON.stringify(release)}는 커넥션을 폐기하고 후속 중복 저장을 막는다`, async () => {
        const database = createSkillsDatabase(release);
        const router = loadSkillsRoute(database.makeModel());
        assert.equal((await requestJson(router, '/skills', { method: 'POST', body: createPayload('첫 기술') })).status, 201);
        assert.equal(database.connections.some(connection => connection.destroyed), true);
        assertNoLockLeaks(database);
        const second = database.makeModel();
        await assert.rejects(second.createSkill(createPayload('중복 기술')), { code: 'SKILL_DISPLAY_ORDER_CONFLICT' });
        assert.equal(database.writes, 1);
        assertOneFeaturedOrder(database);
        assertNoLockLeaks(database);
    });
}
