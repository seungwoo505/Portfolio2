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
            body: await response.json(),
            cacheControl: response.headers.get('cache-control')
        };
    } finally {
        await new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        });
    }
};

const loadPublicRoute = ({ PersonalInfo, CacheUtils }) => {
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
    stubRootModule(['models', 'personal-info.js'], PersonalInfo);
    stubRootModule(['models', 'social-links.js'], {});
    stubRootModule(['models', 'skills.js'], {});
    stubRootModule(['models', 'projects.js'], {});
    stubRootModule(['models', 'blog-posts.js'], {});
    stubRootModule(['models', 'tags.js'], {});
    stubRootModule(['models', 'contact-messages.js'], {});
    stubRootModule(['models', 'experiences.js'], {});
    stubRootModule(['models', 'interests.js'], {});
    stubRootModule(['models', 'site-settings.js'], {});
    stubRootModule(['utils', 'cache.js'], CacheUtils);

    return require(resolveFromRoot(['routes', 'public.js']));
};

test('public cache settings fall back when environment values are invalid', async () => {
    const previousEnv = {
        PUBLIC_CACHE_TTL_SECONDS: process.env.PUBLIC_CACHE_TTL_SECONDS,
        PUBLIC_HTTP_MAX_AGE_SECONDS: process.env.PUBLIC_HTTP_MAX_AGE_SECONDS,
        PUBLIC_HTTP_STALE_SECONDS: process.env.PUBLIC_HTTP_STALE_SECONDS
    };
    const cacheTtls = [];

    process.env.PUBLIC_CACHE_TTL_SECONDS = 'invalid-cache-ttl';
    process.env.PUBLIC_HTTP_MAX_AGE_SECONDS = 'invalid-max-age';
    process.env.PUBLIC_HTTP_STALE_SECONDS = 'invalid-stale';

    try {
        const router = loadPublicRoute({
            PersonalInfo: {
                get: async () => ({ name: 'Tester' })
            },
            CacheUtils: {
                generateKey: (prefix, ...parts) => `${prefix}:${parts.join(':')}`,
                cacheApiResponse: async (_key, loader, ttl) => {
                    cacheTtls.push(ttl);
                    return loader();
                }
            }
        });

        const { status, body, cacheControl } = await requestJson(router, '/profile');

        assert.equal(status, 200);
        assert.equal(body.success, true);
        assert.equal(cacheControl, 'public, max-age=60, stale-while-revalidate=300');
        assert.deepEqual(cacheTtls, [300]);
    } finally {
        Object.entries(previousEnv).forEach(([key, value]) => {
            if (value === undefined) {
                delete process.env[key];
            } else {
                process.env[key] = value;
            }
        });
    }
});
