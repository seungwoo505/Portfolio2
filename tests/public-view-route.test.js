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

const createCacheStub = () => {
    const values = new Map();
    const invalidations = [];

    return {
        invalidations,
        get: (key) => values.get(key),
        set: (key, value) => {
            values.set(key, value);
            return true;
        },
        del: (key) => {
            invalidations.push(['del', key]);
            values.delete(key);
            return true;
        },
        delPattern: (pattern) => {
            invalidations.push(['delPattern', pattern]);
            return 0;
        },
        generateKey: (prefix, ...parts) => `${prefix}:${parts.join(':')}`,
        cacheApiResponse: async (_key, loader) => loader()
    };
};

const loadPublicRoute = ({ Projects, BlogPosts, CacheUtils }) => {
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
        ['log.js']
    ]);

    stubRootModule(['log.js'], createNoopLogger());
    stubRootModule(['models', 'personal-info.js'], {});
    stubRootModule(['models', 'social-links.js'], {});
    stubRootModule(['models', 'skills.js'], {});
    stubRootModule(['models', 'projects.js'], Projects);
    stubRootModule(['models', 'blog-posts.js'], BlogPosts);
    stubRootModule(['models', 'tags.js'], {});
    stubRootModule(['models', 'contact-messages.js'], {});
    stubRootModule(['models', 'experiences.js'], {});
    stubRootModule(['models', 'interests.js'], {});
    stubRootModule(['models', 'site-settings.js'], {});
    stubRootModule(['utils', 'cache.js'], CacheUtils);

    return require(resolveFromRoot(['routes', 'public.js']));
};

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
        },
        BlogPosts: {}
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

test('public post view increments only once for repeated client requests', async () => {
    const increments = [];
    const CacheUtils = createCacheStub();
    const router = loadPublicRoute({
        CacheUtils,
        Projects: {},
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
