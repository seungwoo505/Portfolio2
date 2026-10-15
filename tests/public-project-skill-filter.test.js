const test = require('node:test');
const assert = require('node:assert/strict');
const { createProjectListFixture } = require('./helpers/project-list-fixture');
const { loadPublicRoute } = require('./helpers/public-route-loader');
const { requestJson } = require('./helpers/http-route-server');

const createRouter = async () => {
    const { model } = createProjectListFixture();
    await model.addSkill(1, 1); // CI, CD
    await model.addSkill(2, 2); // React
    await model.addSkill(3, 3); // Node.js
    return loadPublicRoute({ Projects: model });
};

// CSV 분리가 배열 항목에도 적용되거나 명시 배열보다 CSV가 우선하면 실패한다.
for (const { name, query, ids } of [
    { name: '반복 skills는 각 원문 기술명을 보존한다', query: [['skills', ' CI, CD '], ['skills', 'React']], ids: [1, 2] },
    { name: 'skills[]는 단일 쉼표 포함 기술명을 정확히 조회한다', query: [['skills[]', 'CI, CD']], ids: [1] },
    { name: '반복 skills[]는 각 원문 기술명을 보존한다', query: [['skills[]', 'CI, CD'], ['skills[]', 'Node.js']], ids: [1, 3] },
    { name: 'skills[]가 함께 제공된 기존 skills CSV보다 우선한다', query: [['skills', 'React,Node.js'], ['skills[]', 'CI, CD']], ids: [1] },
    { name: '단일 skills CSV의 기존 여러 기술 조회를 유지한다', query: [['skills', 'React,Node.js']], ids: [2, 3] },
    { name: '단일 skills는 URL 인코딩한 쉼표도 기존 CSV로 해석한다', query: [['skills', 'CI, CD']], ids: [] },
    { name: '단일 일반 skills 기술명도 기존처럼 조회한다', query: [['skills', 'React']], ids: [2] }
]) {
    test(`공개 프로젝트 필터: ${name}`, async () => {
        const router = await createRouter();
        const response = await requestJson(router, '/projects?' + new URLSearchParams(query));
        assert.equal(response.status, 200);
        assert.deepEqual(response.body.data.map(project => project.id), ids);
        assert.equal(response.body.pagination.total, ids.length);
        if (ids.includes(1)) assert.deepEqual(response.body.data[0].skills, ['CI, CD']);
    });
}

test('Swagger 배열 직렬화로 전송한 기술명 필터가 실제 공개 HTTP 결과와 일치한다', async () => {
    const { createSwaggerSpec } = require('../config/swagger.ts');
    const parameters = createSwaggerSpec({ port: 3333 }).paths['/public/projects'].get.parameters;
    for (const { name, values, ids } of [
        { name: 'skills', values: ['CI, CD', 'React'], ids: [1, 2] },
        { name: 'skills[]', values: ['CI, CD'], ids: [1] }
    ]) {
        const parameter = parameters.find(item => item.name === name);
        assert.ok(parameter, `${name} 입력 형식이 문서에 필요하다`);
        const query = new URLSearchParams();
        if (parameter.style === 'form' && parameter.explode) {
            values.forEach(value => query.append(parameter.name, value));
        } else {
            query.set(parameter.name, values.join(','));
        }
        const response = await requestJson(await createRouter(), '/projects?' + query);
        assert.equal(response.status, 200);
        assert.deepEqual(response.body.data.map(project => project.id), ids);
    }
});
