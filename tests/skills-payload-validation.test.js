const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSkillsRoute, requestJson } = require('./helpers/skills-route-loader');

for (const method of ['POST', 'PUT']) {
    for (const input of [null, 7, '기술', true, [], [{ name: 'Node.js', category_id: 1 }]]) {
        test(`기술 ${method}는 객체가 아닌 JSON ${JSON.stringify(input)}을 저장 전에 400으로 거절한다`, async () => {
            const writes = [];
            const router = loadSkillsRoute({
                getSkillById: async () => ({ id: 1, is_featured: 0, display_order: 0 }),
                createSkill: async payload => { writes.push(payload); return 1; },
                updateSkill: async (_id, payload) => { writes.push(payload); }
            });

            const result = await requestJson(router, method === 'POST' ? '/skills' : '/skills/1', {
                method, body: input
            });

            assert.equal(result.status, 400);
            assert.equal(result.body.success, false);
            assert.deepEqual(writes, []);
        });
    }
}
