const test = require('node:test');
const assert = require('node:assert/strict');
const { createSkillsDatabase } = require('./helpers/skills-model-fixture');
const { loadSkillsRoute, requestJson } = require('./helpers/skills-route-loader');

const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};
const skill = { id: 1, name: '기존 스킬', category_id: 2, proficiency_level: 50,
    years_of_experience: null, icon: null, color: null, display_order: 0, is_featured: false };
const categories = [{ id: 1, name: '삭제 대상' }, { id: 2, name: '기존 분류' }];
const assertNoLockLeaks = database => {
    assert.equal([...database.locks.values()].every(lock => !lock.owner), true);
    assert.equal(database.connections.every(connection => connection.released || connection.destroyed), true);
};

for (const scenario of [
    { name: '생성', method: 'POST', path: '/skills', body: { name: '새 스킬', category_id: 1 },
        rows: [], sql: 'insert into skills', status: 201 },
    { name: '카테고리 변경', method: 'PUT', path: '/skills/1', body: { category_id: 1 },
        rows: [skill], sql: 'update skills', status: 200 }
]) {
    for (const first of ['delete', 'write']) {
        test(`카테고리 삭제와 ${scenario.name} 경합: ${first} 선점 시 관계를 유실하지 않는다`,
            { timeout: 5000 }, async () => {
                const paused = deferred();
                const resume = deferred();
                const pauseSql = first === 'delete' ? 'delete from skill_categories' : scenario.sql;
                let intercepted = false;
                const database = createSkillsDatabase({ rows: scenario.rows, categories,
                    beforeQuery: async ({ sql }) => {
                        if (!intercepted && sql.startsWith(pauseSql)) {
                            intercepted = true;
                            paused.resolve();
                            await resume.promise;
                        }
                    }
                });
                const deleting = loadSkillsRoute(database.makeModel());
                const writing = loadSkillsRoute(database.makeModel());
                const remove = () => requestJson(deleting, '/skills/categories/1', { method: 'DELETE' });
                const save = () => requestJson(writing, scenario.path, { method: scenario.method, body: scenario.body });
                const firstResult = first === 'delete' ? remove() : save();
                await paused.promise;
                const secondResult = first === 'delete' ? save() : remove();
                // 삭제가 잠금을 보유하면 상대는 대기한다. 기존의 무잠금 삭제에서는
                // 상대 요청을 완료시켜 SELECT 이후 INSERT/DELETE 순서를 재현한다.
                await Promise.race([secondResult, database.waitForLockWaiter()]);
                resume.resolve();
                const [earlier, later] = await Promise.all([firstResult, secondResult]);
                const deleted = first === 'delete' ? earlier : later;
                const written = first === 'delete' ? later : earlier;

                if (first === 'delete') {
                    assert.equal(deleted.status, 200);
                    assert.equal(written.status, 400);
                    assert.equal(database.categories.has(1), false);
                    assert.deepEqual([...database.rows.values()].map(row => row.category_id),
                        scenario.method === 'POST' ? [] : [2]);
                } else {
                    assert.equal(written.status, scenario.status);
                    assert.equal(deleted.status, 400);
                    assert.deepEqual(deleted.body.data, { category_id: 1, skills_count: 1,
                        skills: [{ id: 1, name: scenario.method === 'POST' ? '새 스킬' : '기존 스킬' }] });
                    assert.equal(database.categories.has(1), true);
                    assert.deepEqual([...database.rows.values()].map(row => row.category_id), [1]);
                }
                assertNoLockLeaks(database);
            });
    }
}

test('모델 직접 삭제도 사용 중인 카테고리를 보존한다', async () => {
    const database = createSkillsDatabase({ rows: [{ ...skill, category_id: 1 }] });
    await assert.rejects(() => database.makeModel().deleteCategory(1), { code: 'SKILL_CATEGORY_IN_USE' });
    assert.equal(database.categories.has(1), true);
    assert.equal(database.rows.get(1).category_id, 1);
    assertNoLockLeaks(database);
});

for (const operation of ['create', 'update']) {
    test(`모델 직접 ${operation}도 사라진 카테고리를 저장 전 거절한다`, async () => {
        const database = createSkillsDatabase({ rows: [skill], categories });
        database.categories.delete(1);
        const model = database.makeModel();
        const save = operation === 'create' ? () => model.createSkill({ name: '새 스킬', category_id: 1 })
            : () => model.updateSkill(1, { category_id: 1 });
        await assert.rejects(save, { code: 'SKILL_CATEGORY_NOT_FOUND' });
        assert.equal(database.writes, 0);
        assert.equal(database.rows.get(1).category_id, 2);
        assertNoLockLeaks(database);
    });
}

test('카테고리 삭제는 없는 ID에 기존 404 응답을 유지한다', async () => {
    const database = createSkillsDatabase();
    const result = await requestJson(loadSkillsRoute(database.makeModel()), '/skills/categories/99', { method: 'DELETE' });
    assert.equal(result.status, 404);
    assertNoLockLeaks(database);
});
