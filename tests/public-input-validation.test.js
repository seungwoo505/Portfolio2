const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const requestJson = async (router, path, { method = 'GET' } = {}) => {
    const app = express();
    app.use(router);

    const server = await new Promise((resolve) => {
        const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer));
    });

    try {
        const { port } = server.address();
        const response = await fetch(`http://127.0.0.1:${port}${path}`, { method });
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

const createCacheStub = () => ({
    get: () => undefined,
    set: () => true,
    del: () => true,
    delPattern: () => 0,
    generateKey: (prefix, ...parts) => `${prefix}:${parts.join(':')}`,
    cacheApiResponse: async (_key, loader) => loader()
});

const loadPublicRoute = ({
    Projects = {},
    BlogPosts = {},
    Tags = {},
    CacheUtils = createCacheStub()
} = {}) => {
    clearRootModules([
        ['routes', 'public.js'],
        ['models', 'personal-info.js'],
        ['models', 'social-links.js'],
        ['models', 'skills.js'],
        ['models', 'projects.js'],
        ['models', 'blog-posts.js'],
        ['models', 'tags.js'],
        ['models', 'contact-messages.js'],
        ['models', 'experiences.js'],
        ['models', 'interests.js'],
        ['models', 'site-settings.js'],
        ['utils', 'cache.js'],
        ['utils', 'slug.js'],
        ['log.js']
    ]);

    stubRootModule(['log.js'], createNoopLogger());
    stubRootModule(['models', 'personal-info.js'], {});
    stubRootModule(['models', 'social-links.js'], {});
    stubRootModule(['models', 'skills.js'], {});
    stubRootModule(['models', 'projects.js'], Projects);
    stubRootModule(['models', 'blog-posts.js'], BlogPosts);
    stubRootModule(['models', 'tags.js'], Tags);
    stubRootModule(['models', 'contact-messages.js'], {});
    stubRootModule(['models', 'experiences.js'], {});
    stubRootModule(['models', 'interests.js'], {});
    stubRootModule(['models', 'site-settings.js'], {});
    stubRootModule(['utils', 'cache.js'], CacheUtils);

    return require(resolveFromRoot(['routes', 'public.js']));
};

test('public project list rejects invalid featured filters before model calls', async () => {
    let getWithFiltersCalled = false;
    const router = loadPublicRoute({
        Projects: {
            getWithFilters: async () => {
                getWithFiltersCalled = true;
                return [];
            },
            getCountWithFilters: async () => 0
        }
    });

    const { status, body } = await requestJson(router, '/projects?featured=maybe');

    assert.equal(status, 400);
    assert.equal(body.message, 'featured 값은 boolean이어야 합니다.');
    assert.equal(getWithFiltersCalled, false);
});

test('public post list rejects invalid featured filters before model calls', async () => {
    let getWithFiltersCalled = false;
    const router = loadPublicRoute({
        BlogPosts: {
            getWithFilters: async () => {
                getWithFiltersCalled = true;
                return [];
            },
            getCountWithFilters: async () => 0
        }
    });

    const { status, body } = await requestJson(router, '/posts?featured=maybe');

    assert.equal(status, 400);
    assert.equal(body.message, 'featured 값은 boolean이어야 합니다.');
    assert.equal(getWithFiltersCalled, false);
});

test('public tag list rejects invalid popular filters before model calls', async () => {
    let getAllCalled = false;
    let getPopularCalled = false;
    const router = loadPublicRoute({
        Tags: {
            getAll: async () => {
                getAllCalled = true;
                return [];
            },
            getPopular: async () => {
                getPopularCalled = true;
                return [];
            }
        }
    });

    const { status, body } = await requestJson(router, '/tags?popular=maybe');

    assert.equal(status, 400);
    assert.equal(body.message, 'popular 값은 boolean이어야 합니다.');
    assert.equal(getAllCalled, false);
    assert.equal(getPopularCalled, false);
});

test('public project detail rejects malformed slugs before lookup', async () => {
    let getBySlugCalled = false;
    const router = loadPublicRoute({
        Projects: {
            getBySlug: async () => {
                getBySlugCalled = true;
                return { id: 1, is_published: 1 };
            }
        }
    });

    const { status, body } = await requestJson(router, '/projects/bad.slug');

    assert.equal(status, 400);
    assert.equal(body.message, '유효한 slug가 필요합니다.');
    assert.equal(getBySlugCalled, false);
});

test('public post view rejects malformed slugs before lookup', async () => {
    let getBySlugCalled = false;
    let incrementCalled = false;
    const router = loadPublicRoute({
        BlogPosts: {
            getBySlug: async () => {
                getBySlugCalled = true;
                return { id: 1 };
            },
            incrementView: async () => {
                incrementCalled = true;
            }
        }
    });

    const { status, body } = await requestJson(router, '/posts/bad.slug/view', {
        method: 'POST'
    });

    assert.equal(status, 400);
    assert.equal(body.message, '유효한 slug가 필요합니다.');
    assert.equal(getBySlugCalled, false);
    assert.equal(incrementCalled, false);
});
