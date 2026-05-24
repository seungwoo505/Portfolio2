const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const requestJson = async (router, path, body) => {
    const app = express();
    app.use(express.json());
    app.use(router);

    const server = await new Promise((resolve) => {
        const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer));
    });

    try {
        const { port } = server.address();
        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        return {
            status: response.status,
            body: await response.json()
        };
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
};

const loadBlogRoute = (BlogPosts) => {
    clearRootModules([
        ['routes', 'admin', 'blog.js'],
        ['routes', 'admin', 'common.js'],
        ['models', 'blog-posts.js'],
        ['utils', 'cache.js'],
        ['utils', 'filter-values.js'],
        ['utils', 'pagination.js'],
        ['middleware', 'auth.js'],
        ['log.js']
    ]);

    stubRootModule(['routes', 'admin', 'common.js'], {
        logger: createNoopLogger(),
        buildErrorLog: (error) => ({ error: error.message })
    });
    stubRootModule(['models', 'blog-posts.js'], BlogPosts);
    stubRootModule(['utils', 'cache.js'], { invalidateResources: () => 0 });
    stubRootModule(['middleware', 'auth.js'], {
        authenticateToken: (req, _res, next) => {
            req.admin = { id: 1, role: 'super_admin' };
            next();
        },
        requirePermission: () => (_req, _res, next) => next(),
        logActivity: () => (_req, _res, next) => next()
    });

    return require(resolveFromRoot(['routes', 'admin', 'blog.js']));
};

test('admin blog publish status normalizes boolean-like strings', async () => {
    const updates = [];
    const router = loadBlogRoute({
        getBySlugAdmin: async () => ({ id: 5 }),
        update: async (_id, payload) => {
            updates.push(payload);
            return { id: 5, ...payload };
        },
        getAll: async () => [],
        getCountWithFilters: async () => 0,
        create: async () => 1,
        getById: async () => ({ id: 1 }),
        delete: async () => {}
    });

    const { status, body } = await requestJson(router, '/blog/posts/slug/test-post/publish', {
        is_published: 'false'
    });

    assert.equal(status, 200);
    assert.deepEqual(updates, [{ is_published: false }]);
    assert.equal(body.message, '포스트 발행이 취소되었습니다.');
});

test('admin blog featured status rejects invalid booleans', async () => {
    const updates = [];
    const router = loadBlogRoute({
        getBySlugAdmin: async () => {
            throw new Error('should not query before validation');
        },
        update: async (_id, payload) => {
            updates.push(payload);
        },
        getAll: async () => [],
        getCountWithFilters: async () => 0,
        create: async () => 1,
        getById: async () => ({ id: 1 }),
        delete: async () => {}
    });

    const { status, body } = await requestJson(router, '/blog/posts/slug/test-post/featured', {
        is_featured: 'maybe'
    });

    assert.equal(status, 400);
    assert.equal(body.message, '추천 상태는 boolean 값이어야 합니다.');
    assert.deepEqual(updates, []);
});
