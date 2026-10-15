const test = require('node:test');
const assert = require('node:assert/strict');
const { createNoopLogger, stubRootModule } = require('./helpers/module-loader');
const { loadPublicRoute } = require('./helpers/public-route-loader');
const { startRouterServer } = require('./helpers/http-route-server');

stubRootModule(['log.ts'], createNoopLogger());
const CacheUtils = require('../utils/cache/index.ts');

const contactBody = message => ({
    name: '홍길동',
    email: 'person@example.com',
    subject: '문의',
    message
});

const cases = [
    {
        name: 'contact',
        existing: { path: '/contact', body: contactBody('이미 접수한 문의') },
        pending: { path: '/contact', body: contactBody('새로 접수할 문의') },
        success: 201,
        duplicate: 409,
        model: record => ({ ContactMessages: {
            createWithRateLimit: async payload => {
                record(payload);
                return 42;
            }
        } })
    },
    {
        name: 'project view',
        existing: { path: '/projects/existing-project/view' },
        pending: { path: '/projects/new-project/view' },
        success: 200,
        duplicate: 200,
        model: record => ({ Projects: {
            getBySlug: async () => ({ id: 10, is_published: 1 }),
            incrementView: async id => record(id)
        } })
    },
    {
        name: 'post view',
        existing: { path: '/posts/existing-post/view' },
        pending: { path: '/posts/new-post/view' },
        success: 200,
        duplicate: 200,
        model: record => ({ BlogPosts: {
            getBySlug: async () => ({ id: 20, status: 'published' }),
            incrementView: async id => record(id)
        } })
    }
];

const submit = async (baseUrl, { path, body }) => {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': 'claim-capacity-test' },
        body: body === undefined ? undefined : JSON.stringify(body)
    });
    return {
        status: response.status,
        cacheControl: response.headers.get('Cache-Control'),
        body: await response.json()
    };
};

for (const fixture of cases) {
    test(`public ${fixture.name} refuses unreserved writes at cache capacity and recovers without losing reservations`, async () => {
        CacheUtils.flush();
        const writes = [];
        const router = loadPublicRoute({ CacheUtils, ...fixture.model(value => writes.push(value)) });
        const server = await startRouterServer(router, { json: true });

        try {
            assert.equal((await submit(server.baseUrl, fixture.existing)).status, fixture.success);
            assert.equal(writes.length, 1);

            for (let index = 0; index < 1999; index += 1) {
                assert.equal(CacheUtils.set(`capacity:${index}`, { index }), true);
            }
            assert.equal(CacheUtils.getStats().keys, 2000);
            assert.equal(CacheUtils.set('capacity:overflow', true), false);

            for (let attempt = 0; attempt < 2; attempt += 1) {
                const rejected = await submit(server.baseUrl, fixture.pending);
                assert.equal(rejected.status, 503);
                assert.equal(rejected.cacheControl, 'no-store');
                assert.equal(rejected.body.success, false);
                assert.equal(typeof rejected.body.message, 'string');
                assert.equal(/cache|claim|캐시|선점/i.test(JSON.stringify(rejected.body)), false);
                assert.equal(writes.length, 1);
            }

            assert.equal((await submit(server.baseUrl, fixture.existing)).status, fixture.duplicate);
            assert.equal(writes.length, 1);
            assert.equal(CacheUtils.getStats().keys, 2000);
            assert.deepEqual(CacheUtils.get('capacity:1998'), { index: 1998 });

            CacheUtils.del('capacity:0');
            assert.equal((await submit(server.baseUrl, fixture.pending)).status, fixture.success);
            assert.equal((await submit(server.baseUrl, fixture.pending)).status, fixture.duplicate);
            assert.equal(writes.length, 2);
            assert.equal((await submit(server.baseUrl, fixture.existing)).status, fixture.duplicate);
            assert.equal(writes.length, 2);
            assert.deepEqual(CacheUtils.get('capacity:1998'), { index: 1998 });
        } finally {
            await server.close();
            CacheUtils.flush();
        }
    });
}
