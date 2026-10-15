const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { rootDir, stubRootModule, createNoopLogger } = require('./helpers/module-loader');
const { loadAdminRoute, requestJson } = require('./helpers/admin-route-loader');

const loadFixture = family => {
    const table = family.replaceAll('-', '_');
    const directory = path.join(rootDir, 'models', family);
    for (const key of Object.keys(require.cache)) {
        if (key === directory + '.ts' || key.startsWith(directory + path.sep)) delete require.cache[key];
    }
    const row = { id: 1, title: 'Original Title', name: 'Original Name', slug: 'custom-address', content: '본문', is_published: 1 };
    const execute = async (query, params = []) => {
        const sql = query.replace(/\s+/g, ' ').trim().toLowerCase();
        if (sql.startsWith('select * from ' + table)) {
            return sql.includes('where slug') && params[0] !== row.slug ? [] : [{ ...row }];
        }
        if (sql.startsWith('select id')) return params[0] === 'taken-address' ? [{ id: 2 }] : [];
        if (sql.startsWith('update ' + table)) {
            let offset = 0;
            for (const assignment of sql.split(' set ')[1].split(' where ')[0].split(',')) {
                const field = assignment.trim().match(/^(\w+) = \?$/);
                if (field) row[field[1]] = params[offset++];
            }
        }
        return sql.startsWith('select') ? [] : { affectedRows: 1 };
    };
    stubRootModule(['models', 'db-utils.ts'], {
        executeQuery: execute,
        executeQuerySingle: async (q, p) => (await execute(q, p))[0] || null,
        executeConnectionQuery: async (_c, q, p) => execute(q, p),
        executeConnectionQuerySingle: async (_c, q, p) => (await execute(q, p))[0] || null,
        executeTransaction: async callback => callback({})
    });
    stubRootModule(['log.ts'], createNoopLogger());
    stubRootModule(['utils', 'cache.ts'], {
        generateKey: (...parts) => parts.join(':'),
        cacheApiResponse: async (_key, load) => load(),
        invalidateResources: () => 0
    });
    return { model: require(path.join(rootDir, 'models', family + '.ts')), row };
};

for (const family of ['blog-posts', 'projects', 'tags']) {
    const routeName = family === 'blog-posts' ? 'blog' : family;
    const url = family === 'tags' ? '/tags/1' : `/${family === 'blog-posts' ? 'blog/posts' : family}/slug/custom-address`;
    for (const renamed of [false, true]) {
        test(`${family}: ${renamed ? '이름을 변경해도' : '같은 이름을 저장해도'} 생략한 slug를 보존한다`, async () => {
            const { model, row } = loadFixture(family);
            const router = loadAdminRoute(['routes', 'admin', routeName + '.ts'], [{
                segments: ['models', family + '.ts'], moduleExports: model
            }]);
            const field = family === 'tags' ? 'name' : 'title';
            const response = await requestJson(router, url, {
                method: 'PUT', body: { [field]: renamed ? 'Changed Name' : row[field] }
            });
            assert.equal(response.status, 200);
            assert.equal(row.slug, 'custom-address');
            if (family !== 'tags') assert.equal((await requestJson(router, url)).status, 200);
        });
    }

    test(`${family}: 명시한 slug 변경에는 중복 회피를 적용한다`, async () => {
        const { model, row } = loadFixture(family);
        await model.update(1, { slug: 'taken-address' });
        assert.equal(row.slug, 'taken-address-1');
    });
}
