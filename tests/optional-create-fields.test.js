const test = require('node:test');
const assert = require('node:assert/strict');
const { clearRootModule, createNoopLogger, stubRootModule } = require('./helpers/module-loader');
const { createAdminIdentityFixture } = require('./helpers/admin-identity-fixture');
const { loadAdminRoute, requestJson } = require('./helpers/admin-route-loader');
const { loadUsersRoute } = require('./helpers/admin-auth-route-loader');

const cases = [
    { name: '관리자', model: ['models', 'admin-users', 'users.ts'], path: '/users', body: { username: 'new-admin', email: 'admin@example.com', password: 'StrongPassword123' } },
    { name: '소셜 링크', model: ['models', 'social-links.ts'], route: ['routes', 'admin', 'profile.ts'], path: '/social-links', body: { platform: 'GitHub', url: 'https://example.com' } },
    { name: '관심사', model: ['models', 'interests.ts'], route: ['routes', 'admin', 'interests.ts'], path: '/interests', body: { title: '독서', category: '생활' } },
    { name: '태그', model: ['models', 'tags.ts'], route: ['routes', 'admin', 'tags.ts'], path: '/tags', body: { name: '신규태그' } }
];

const db = {
    executeQuery: async (_query, params = []) => {
        if (params.includes(undefined)) throw new TypeError('undefined SQL binding');
        return { insertId: 1, affectedRows: 1 };
    },
    executeQuerySingle: async query => /where id = \?/i.test(query) ? { id: 1 } : null
};

for (const entry of cases) {
    test(`${entry.name} 생성은 선택 항목을 생략해도 성공한다`, async () => {
        let model;
        if (entry.name === '관리자') {
            ({ AdminUsers: model } = await createAdminIdentityFixture());
        } else {
            stubRootModule(['models', 'db-utils.ts'], db);
            stubRootModule(['log.ts'], createNoopLogger());
            clearRootModule(entry.model);
            model = require(`../${entry.model.join('/')}`);
        }
        const router = entry.name === '관리자' ? loadUsersRoute(model) : loadAdminRoute(entry.route, [{
            segments: entry.model, moduleExports: model
        }]);
        const result = await requestJson(router, entry.path, { method: 'POST', body: entry.body });

        assert.equal(result.status, 201);
        assert.equal(result.body.success, true);
        if (entry.name === '관리자') {
            assert.equal(result.body.data.full_name, null);
            assert.equal(result.body.data.role, 'admin');
        }
    });
}
