const test = require('node:test');
const assert = require('node:assert/strict');
const { createContentTagFixture } = require('./helpers/content-tag-fixture');
const { createSkillsDatabase } = require('./helpers/skills-model-fixture');
const { loadPublicRoute } = require('./helpers/public-route-loader');
const { loadSkillsRoute } = require('./helpers/skills-route-loader');
const { requestJson } = require('./helpers/http-route-server');
const { createCacheStub } = require('./helpers/cache-stub');

const createProject = (model, title = '이름 보존', tags = []) => model.create({
    title, slug: title === '이름 보존' ? 'demo' : 'other', content: '본문',
    is_published: true, is_featured: true, tags
});
const createFixture = names => createContentTagFixture('projects', {
    skills: new Map(names.map((name, index) => [index + 9, { id: index + 9, name }]))
});

// Node 20 CI에서도 항상 실행하며 실제 모델의 SQL/바인딩 아래 DB 상태만 대체한다.
// 쉼표 분리, 정렬 누락, 1024자 집계 제한 또는 항목별 조회가 되돌아오면 실패한다.
for (const method of ['getAll', 'getWithFilters', 'getFeatured']) {
    test(`projects.${method}: 스킬명을 상세와 동일하게 보존하고 이름순으로 반환한다`, async () => {
        const { model } = createFixture(['Zulu', 'CI, CD', 'API "구현"\\경로']);
        const id = await createProject(model, '이름 보존', ['설계, 구현', 'API "태그"\\경로']);
        const emptyId = await createProject(model, '연결 없음');
        for (const skillId of [9, 10, 11]) await model.addSkill(id, skillId);
        const list = await model[method]();
        const item = list.find(row => row.id === id);
        assert.deepEqual(item.skills, ['API "구현"\\경로', 'CI, CD', 'Zulu']);
        assert.deepEqual((await model.getById(id)).skills.map(skill => skill.name), ['API "구현"\\경로', 'CI, CD', 'Zulu']);
        assert.deepEqual(item.tags, ['API "태그"\\경로', '설계, 구현']);
        assert.deepEqual(list.find(row => row.id === emptyId).skills, []);
        assert.deepEqual(list.find(row => row.id === emptyId).tags, []);
    });
}

test('프로젝트 검색도 쉼표 포함 스킬명을 원래 이름 하나로 반환한다', async () => {
    const { model } = createFixture(['CI, CD']);
    const id = await createProject(model);
    await model.addSkill(id, 9);
    await createProject(model, '다른 항목');
    const list = await model.getWithFilters({ search: '이름 보존' });
    assert.deepEqual(list.map(row => row.id), [id]);
    assert.deepEqual(list[0].skills, ['CI, CD']);
});

test('프로젝트별 스킬 전체 이름을 1024자 이상 보존하고 목록 전체에 한 번 조회한다', async () => {
    const names = Array.from({ length: 30 }, (_, index) => `${String(index).padStart(2, '0')}-${'가'.repeat(50)}, 기술`);
    const { model, operations } = createFixture([...names, '별도 스킬']);
    const id = await createProject(model);
    const otherId = await createProject(model, '별도 항목');
    for (let index = 0; index < names.length; index += 1) await model.addSkill(id, index + 9);
    await model.addSkill(otherId, 39);
    operations.length = 0;
    const list = await model.getAll();
    assert.deepEqual(list.find(row => row.id === id).skills, names);
    assert.deepEqual(list.find(row => row.id === otherId).skills, ['별도 스킬']);
    const relationQueries = operations.filter(operation => operation.sql.includes('from project_skills ps inner join skills s'));
    assert.equal(relationQueries.length, 1);
    assert.deepEqual(relationQueries[0].params, [id, otherId]);
    assert.equal(operations.length, 4, '목록 + 태그 + 스킬 + 이미지의 네 쿼리로 처리해야 한다');
});

test('프로젝트 목록이 비어 있으면 스킬/태그 관계를 추가 조회하지 않는다', async () => {
    const { model, operations } = createFixture(['CI, CD']);
    assert.deepEqual(await model.getAll(), []);
    assert.equal(operations.length, 1);
});

test('관리자 PUT으로 저장한 쉼표 포함 기술명이 공개 목록·검색·상세 응답에 동일하게 표시된다', async () => {
    const database = createSkillsDatabase({ rows: [{ id: 9, name: 'OldSkill', is_featured: 0, display_order: 0 }] });
    const Skills = database.makeModel();
    const { model } = createContentTagFixture('projects', { skills: database.rows });
    const id = await createProject(model, '이름 보존', ['설계, 구현']);
    await model.addSkill(id, 9);
    const cache = createCacheStub();
    const publicRouter = loadPublicRoute({ Projects: model, CacheUtils: cache });
    const adminRouter = loadSkillsRoute(Skills, cache);
    const changed = await requestJson(adminRouter, '/skills/9', { method: 'PUT', body: { name: 'CI, CD' } });
    assert.equal(changed.status, 200);
    assert.equal(changed.body.data.name, 'CI, CD');
    for (const url of ['/projects', '/projects?search=' + encodeURIComponent('이름 보존')]) {
        const response = await requestJson(publicRouter, url);
        assert.equal(response.status, 200);
        assert.deepEqual(response.body.data[0].skills, ['CI, CD']);
        assert.deepEqual(response.body.data[0].tags, ['설계, 구현']);
    }
    const detail = await requestJson(publicRouter, '/projects/demo');
    assert.equal(detail.status, 200);
    assert.deepEqual(detail.body.data.skills.map(skill => skill.name), ['CI, CD']);
    assert.deepEqual(detail.body.data.tags.map(tag => tag.name), ['설계, 구현']);
});
