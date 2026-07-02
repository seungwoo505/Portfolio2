const test = require('node:test');
const assert = require('node:assert/strict');
const {
    loadSkillsRoute,
    requestJson
} = require('./helpers/skills-route-loader');

test('admin skills create normalizes numeric and boolean fields', async () => {
    const createdPayloads = [];
    const router = loadSkillsRoute({
        getByDisplayOrder: async () => null,
        createSkill: async (payload) => {
            createdPayloads.push(payload);
            return 9;
        },
        getSkillById: async (id) => ({ id })
    });

    const { status } = await requestJson(router, '/skills', {
        method: 'POST',
        body: {
            name: ' Node.js ',
            slug: ' node-js ',
            category_id: '3',
            proficiency_level: '80',
            years_of_experience: '2.5',
            icon: '',
            color: '#339933',
            display_order: '4',
            is_featured: 'true'
        }
    });

    assert.equal(status, 201);
    assert.deepEqual(createdPayloads, [{
        name: 'Node.js',
        slug: 'node-js',
        category_id: 3,
        proficiency_level: 80,
        years_of_experience: 2.5,
        icon: null,
        color: '#339933',
        display_order: 4,
        is_featured: true
    }]);
});

test('admin skills create rejects fractional integer fields before model calls', async () => {
    let createCalled = false;
    const router = loadSkillsRoute({
        getByDisplayOrder: async () => null,
        createSkill: async () => {
            createCalled = true;
            return 9;
        },
        getSkillById: async (id) => ({ id })
    });

    const { status, body } = await requestJson(router, '/skills', {
        method: 'POST',
        body: {
            name: 'Node.js',
            category_id: '3',
            proficiency_level: '1.5'
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, '숙련도는 0부터 100 사이의 숫자여야 합니다.');
    assert.equal(createCalled, false);
});

test('admin skills update only writes provided fields', async () => {
    const updatedPayloads = [];
    const router = loadSkillsRoute({
        getSkillById: async (id) => ({
            id,
            is_featured: 0,
            display_order: 5
        }),
        getByDisplayOrder: async () => null,
        updateSkill: async (_id, payload) => {
            updatedPayloads.push(payload);
        }
    });

    const { status } = await requestJson(router, '/skills/9', {
        method: 'PUT',
        body: {
            proficiency_level: '70'
        }
    });

    assert.equal(status, 200);
    assert.deepEqual(updatedPayloads, [{ proficiency_level: 70 }]);
});
