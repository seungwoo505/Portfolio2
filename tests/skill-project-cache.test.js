const test = require('node:test');
const assert = require('node:assert/strict');
const { stubRootModule, createNoopLogger } = require('./helpers/module-loader');
const { loadPublicRoute } = require('./helpers/public-route-loader');
const { loadSkillsRoute } = require('./helpers/skills-route-loader');
const { requestJson } = require('./helpers/http-route-server');

for (const method of ['PUT', 'DELETE']) {
    test(`기술 ${method} 후 공개 프로젝트에 최신 기술 관계가 표시된다`, async () => {
        stubRootModule(['log.ts'], createNoopLogger());
        // 공개 라우트 로더가 루트 캐시 모듈을 바꾸므로 실제 구현을 직접 사용한다.
        const CacheUtils = require('../utils/cache/index.ts');
        CacheUtils.flush();
        let skill = { id: 9, name: 'OldSkill', is_featured: 0 };
        const publicRouter = loadPublicRoute({ CacheUtils, Projects: {
            getBySlug: async () => ({ id: 1, slug: 'demo', is_published: 1, skills: skill ? [{ ...skill }] : [] })
        } });
        const adminRouter = loadSkillsRoute({
            getSkillById: async () => skill,
            updateSkill: async (_id, changes) => { skill = { ...skill, ...changes }; },
            deleteSkill: async () => { skill = null; }
        }, CacheUtils);
        try {
            const before = await requestJson(publicRouter, '/projects/demo');
            assert.equal(before.body.data.skills[0].name, 'OldSkill');
            const changed = await requestJson(adminRouter, '/skills/9', {
                method, ...(method === 'PUT' ? { body: { name: 'NewSkill' } } : {})
            });
            assert.equal(changed.status, 200);
            const after = await requestJson(publicRouter, '/projects/demo');
            assert.deepEqual(after.body.data.skills.map(item => item.name), method === 'PUT' ? ['NewSkill'] : []);
        } finally {
            CacheUtils.flush();
        }
    });
}
