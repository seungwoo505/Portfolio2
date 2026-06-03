const test = require('node:test');
const assert = require('node:assert/strict');
const {
    loadSkillsRoute,
    requestJson
} = require('./helpers/skills-route-loader');

test('admin skill category create rejects missing bodies before model calls', async () => {
    let getCategoryByNameCalled = false;
    let createCategoryCalled = false;
    const router = loadSkillsRoute({
        getCategoryByName: async () => {
            getCategoryByNameCalled = true;
            return null;
        },
        createCategory: async () => {
            createCategoryCalled = true;
            return 1;
        }
    });

    const { status, body } = await requestJson(router, '/skills/categories', {
        method: 'POST'
    });

    assert.equal(status, 400);
    assert.equal(body.message, '카테고리명을 입력해주세요.');
    assert.equal(getCategoryByNameCalled, false);
    assert.equal(createCategoryCalled, false);
});
