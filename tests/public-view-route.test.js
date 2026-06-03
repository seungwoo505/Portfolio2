const test = require('node:test');
const assert = require('node:assert/strict');
const {
    readJsonResponse,
    requestJson,
    startRouterServer,
    waitFor
} = require('./helpers/http-route-server');
const { createCacheStub } = require('./helpers/cache-stub');
const { loadPublicRoute } = require('./helpers/public-route-loader');

test('public project view increments only once for repeated client requests', async () => {
    const increments = [];
    const CacheUtils = createCacheStub();
    const router = loadPublicRoute({
        CacheUtils,
        Projects: {
            getBySlug: async () => ({ id: 10, is_published: 1 }),
            incrementView: async (id) => {
                increments.push(id);
            }
        }
    });

    const first = await requestJson(router, '/projects/project-a/view', { method: 'POST' });
    const second = await requestJson(router, '/projects/project-a/view', { method: 'POST' });

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.deepEqual(increments, [10]);
    assert.deepEqual(CacheUtils.invalidations, [
        ['del', 'project:public:slug:project-a'],
        ['delPattern', 'projects:public:']
    ]);
});

test('public project view claims dedupe before increment completes', async () => {
    const increments = [];
    const CacheUtils = createCacheStub();
    let resolveIncrement;
    const incrementBlock = new Promise((resolve) => {
        resolveIncrement = resolve;
    });
    const router = loadPublicRoute({
        CacheUtils,
        Projects: {
            getBySlug: async () => ({ id: 10, is_published: 1 }),
            incrementView: async (id) => {
                increments.push(id);
                await incrementBlock;
            }
        }
    });
    const server = await startRouterServer(router);

    try {
        const first = fetch(`${server.baseUrl}/projects/project-a/view`, { method: 'POST' }).then(readJsonResponse);
        await waitFor(() => increments.length === 1);
        const second = await fetch(`${server.baseUrl}/projects/project-a/view`, { method: 'POST' }).then(readJsonResponse);

        assert.equal(second.status, 200);
        assert.equal(increments.length, 1);

        resolveIncrement();
        const firstResult = await first;

        assert.equal(firstResult.status, 200);
        assert.deepEqual(increments, [10]);
    } finally {
        resolveIncrement?.();
        await server.close();
    }
});

test('public post view increments only once for repeated client requests', async () => {
    const increments = [];
    const CacheUtils = createCacheStub();
    const router = loadPublicRoute({
        CacheUtils,
        BlogPosts: {
            getBySlug: async () => ({ id: 20 }),
            incrementView: async (id) => {
                increments.push(id);
            }
        }
    });

    const first = await requestJson(router, '/posts/post-a/view', { method: 'POST' });
    const second = await requestJson(router, '/posts/post-a/view', { method: 'POST' });

    assert.equal(first.status, 200);
    assert.equal(second.status, 200);
    assert.deepEqual(increments, [20]);
    assert.deepEqual(CacheUtils.invalidations, [
        ['del', 'blog_post:public:slug:post-a'],
        ['delPattern', 'blog_posts:public:']
    ]);
});

test('public post view claims dedupe before increment completes', async () => {
    const increments = [];
    const CacheUtils = createCacheStub();
    let resolveIncrement;
    const incrementBlock = new Promise((resolve) => {
        resolveIncrement = resolve;
    });
    const router = loadPublicRoute({
        CacheUtils,
        BlogPosts: {
            getBySlug: async () => ({ id: 20 }),
            incrementView: async (id) => {
                increments.push(id);
                await incrementBlock;
            }
        }
    });
    const server = await startRouterServer(router);

    try {
        const first = fetch(`${server.baseUrl}/posts/post-a/view`, { method: 'POST' }).then(readJsonResponse);
        await waitFor(() => increments.length === 1);
        const second = await fetch(`${server.baseUrl}/posts/post-a/view`, { method: 'POST' }).then(readJsonResponse);

        assert.equal(second.status, 200);
        assert.equal(increments.length, 1);

        resolveIncrement();
        const firstResult = await first;

        assert.equal(firstResult.status, 200);
        assert.deepEqual(increments, [20]);
    } finally {
        resolveIncrement?.();
        await server.close();
    }
});
