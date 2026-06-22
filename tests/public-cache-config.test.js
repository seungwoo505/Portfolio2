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
        ['routes', 'public.ts'],
        ['routes', 'public', 'index.ts'],
        ['routes', 'public', 'common.ts'],
        ['routes', 'public', 'common', 'cache.ts'],
        ['routes', 'public', 'common', 'config.ts'],
        ['routes', 'public', 'common', 'contact.ts'],
        ['routes', 'public', 'common', 'filters.ts'],
        ['routes', 'public', 'common', 'index.ts'],
        ['routes', 'public', 'common', 'responses.ts'],
        ['routes', 'public', 'common', 'views.ts'],
        ['routes', 'public', 'profile.ts'],
        ['routes', 'public', 'contact.ts'],
        ['routes', 'public', 'skills.ts'],
        ['routes', 'public', 'projects.ts'],
        ['routes', 'public', 'posts.ts'],
        ['routes', 'public', 'tags.ts'],
        ['routes', 'public', 'experiences.ts'],
        ['routes', 'public', 'interests.ts'],
        ['models', 'personal-info.ts'],
        ['models', 'social-links.ts'],
        ['models', 'skills.ts'],
        ['models', 'projects.ts'],
        ['models', 'blog-posts.ts'],
        ['models', 'tags.ts'],
        ['models', 'contact-messages.ts'],
        ['models', 'experiences.ts'],
        ['models', 'interests.ts'],
        ['models', 'site-settings.ts'],
        ['utils', 'cache.ts'],
        ['log.ts']
    ]);

    stubRootModule(['log.ts'], createNoopLogger());
    stubRootModule(['models', 'personal-info.ts'], PersonalInfo);
    stubRootModule(['models', 'social-links.ts'], {});
    stubRootModule(['models', 'skills.ts'], {});
    stubRootModule(['models', 'projects.ts'], {});
    stubRootModule(['models', 'blog-posts.ts'], {});
    stubRootModule(['models', 'tags.ts'], {});
    stubRootModule(['models', 'contact-messages.ts'], {});
    stubRootModule(['models', 'experiences.ts'], {});
    stubRootModule(['models', 'interests.ts'], {});
    stubRootModule(['models', 'site-settings.ts'], {});
    stubRootModule(['utils', 'cache.ts'], CacheUtils);

    return require(resolveFromRoot(['routes', 'public.ts']));
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
