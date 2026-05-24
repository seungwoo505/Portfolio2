const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const requestJson = async (router, path) => {
    const app = express();
    app.use(router);

    const server = await new Promise((resolve) => {
        const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer));
    });

    try {
        const { port } = server.address();
        const response = await fetch(`http://127.0.0.1:${port}${path}`);
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

const stubAdminMiddleware = () => {
    stubRootModule(['middleware', 'auth.js'], {
        authenticateToken: (req, _res, next) => {
            req.admin = { id: 1, role: 'super_admin' };
            next();
        },
        requirePermission: () => (_req, _res, next) => next(),
        logActivity: () => (_req, _res, next) => next()
    });
};

test('admin blog list returns count-based pagination total', async () => {
    clearRootModules([
        ['routes', 'admin', 'blog.js'],
        ['routes', 'admin', 'common.js'],
        ['models', 'blog-posts.js'],
        ['utils', 'cache.js'],
        ['utils', 'pagination.js'],
        ['middleware', 'auth.js'],
        ['log.js']
    ]);

    const countFilters = [];
    stubRootModule(['routes', 'admin', 'common.js'], {
        logger: createNoopLogger(),
        buildErrorLog: (error) => ({ error: error.message })
    });
    stubRootModule(['models', 'blog-posts.js'], {
        getAll: async () => [{ id: 1 }],
        getCountWithFilters: async (filters) => {
            countFilters.push(filters);
            return 42;
        }
    });
    stubRootModule(['utils', 'cache.js'], { invalidateResources: () => 0 });
    stubAdminMiddleware();

    const router = require(resolveFromRoot(['routes', 'admin', 'blog.js']));
    const { status, body } = await requestJson(router, '/blog/posts?limit=2&page=3');

    assert.equal(status, 200);
    assert.deepEqual(countFilters, [{ status: 'all', published_only: false }]);
    assert.deepEqual(body.pagination, {
        page: 3,
        limit: 2,
        total: 42,
        totalPages: 21
    });
});

test('admin featured project list returns count-based pagination total', async () => {
    clearRootModules([
        ['routes', 'admin', 'projects.js'],
        ['routes', 'admin', 'common.js'],
        ['models', 'projects.js'],
        ['utils', 'cache.js'],
        ['utils', 'filter-values.js'],
        ['utils', 'pagination.js'],
        ['middleware', 'auth.js'],
        ['log.js']
    ]);

    const featuredCalls = [];
    const countFilters = [];
    stubRootModule(['routes', 'admin', 'common.js'], {
        logger: createNoopLogger(),
        verboseDebug: () => {},
        buildErrorLog: (error) => ({ error: error.message })
    });
    stubRootModule(['models', 'projects.js'], {
        getFeatured: async (limit, offset) => {
            featuredCalls.push({ limit, offset });
            return [{ id: 1 }];
        },
        getAll: async () => [],
        getCountWithFilters: async (filters) => {
            countFilters.push(filters);
            return 7;
        }
    });
    stubRootModule(['utils', 'cache.js'], { invalidateResources: () => 0 });
    stubAdminMiddleware();

    const router = require(resolveFromRoot(['routes', 'admin', 'projects.js']));
    const { status, body } = await requestJson(router, '/projects?featured=true&limit=2&page=2');

    assert.equal(status, 200);
    assert.deepEqual(featuredCalls, [{ limit: 2, offset: 2 }]);
    assert.deepEqual(countFilters, [{
        featured: true,
        status: 'published',
        published_only: true
    }]);
    assert.deepEqual(body.pagination, {
        page: 2,
        limit: 2,
        total: 7,
        totalPages: 4
    });
});

test('admin project list rejects invalid featured filters before model calls', async () => {
    clearRootModules([
        ['routes', 'admin', 'projects.js'],
        ['routes', 'admin', 'common.js'],
        ['models', 'projects.js'],
        ['utils', 'cache.js'],
        ['utils', 'filter-values.js'],
        ['utils', 'pagination.js'],
        ['middleware', 'auth.js'],
        ['log.js']
    ]);

    let getAllCalled = false;
    let getFeaturedCalled = false;
    stubRootModule(['routes', 'admin', 'common.js'], {
        logger: createNoopLogger(),
        verboseDebug: () => {},
        buildErrorLog: (error) => ({ error: error.message })
    });
    stubRootModule(['models', 'projects.js'], {
        getFeatured: async () => {
            getFeaturedCalled = true;
            return [];
        },
        getAll: async () => {
            getAllCalled = true;
            return [];
        },
        getCountWithFilters: async () => 0
    });
    stubRootModule(['utils', 'cache.js'], { invalidateResources: () => 0 });
    stubAdminMiddleware();

    const router = require(resolveFromRoot(['routes', 'admin', 'projects.js']));
    const { status, body } = await requestJson(router, '/projects?featured=maybe');

    assert.equal(status, 400);
    assert.equal(body.message, 'featured 값은 boolean이어야 합니다.');
    assert.equal(getAllCalled, false);
    assert.equal(getFeaturedCalled, false);
});
