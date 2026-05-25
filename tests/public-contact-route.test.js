const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const requestJson = async (router, path, { method = 'GET', body = undefined } = {}) => {
    const app = express();
    app.use(express.json({ strict: false }));
    app.use(router);

    const server = await new Promise((resolve) => {
        const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer));
    });

    try {
        const { port } = server.address();
        const hasBody = body !== undefined;
        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
            method,
            headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
            body: hasBody ? JSON.stringify(body) : undefined
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

const startRouterServer = async (router) => {
    const app = express();
    app.use(express.json({ strict: false }));
    app.use(router);

    const server = await new Promise((resolve) => {
        const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer));
    });

    return {
        baseUrl: `http://127.0.0.1:${server.address().port}`,
        close: () => new Promise((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
        })
    };
};

const postJson = async (baseUrl, path, body) => {
    const response = await fetch(`${baseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    return {
        status: response.status,
        body: await response.json()
    };
};

const waitFor = async (predicate, timeoutMs = 500) => {
    const startedAt = Date.now();

    while (!predicate()) {
        if (Date.now() - startedAt > timeoutMs) {
            throw new Error('condition was not met in time');
        }
        await new Promise((resolve) => setTimeout(resolve, 5));
    }
};

const createCacheStub = () => {
    const values = new Map();

    return {
        get: (key) => values.get(key),
        set: (key, value) => {
            values.set(key, value);
            return true;
        },
        claim: (key, ttl) => {
            if (values.has(key)) {
                return false;
            }
            values.set(key, true, ttl);
            return true;
        },
        release: (key) => {
            values.delete(key);
            return true;
        },
        del: () => true,
        delPattern: () => 0,
        generateKey: (prefix, ...parts) => `${prefix}:${parts.join(':')}`,
        cacheApiResponse: async (_key, loader) => loader()
    };
};

const loadPublicRoute = ({ ContactMessages, CacheUtils }) => {
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
    stubRootModule(['models', 'projects.js'], {});
    stubRootModule(['models', 'blog-posts.js'], {});
    stubRootModule(['models', 'tags.js'], {});
    stubRootModule(['models', 'contact-messages.js'], ContactMessages);
    stubRootModule(['models', 'experiences.js'], {});
    stubRootModule(['models', 'interests.js'], {});
    stubRootModule(['models', 'site-settings.js'], {});
    stubRootModule(['utils', 'cache.js'], CacheUtils);

    return require(resolveFromRoot(['routes', 'public.js']));
};

test('public contact rejects duplicate submissions before creating another message', async () => {
    const createdPayloads = [];
    const router = loadPublicRoute({
        CacheUtils: createCacheStub(),
        ContactMessages: {
            countRecentByIp: async () => 0,
            create: async (payload) => {
                createdPayloads.push(payload);
                return 42;
            }
        }
    });
    const body = {
        name: '홍길동',
        email: 'person@example.com',
        subject: '문의',
        message: '같은 문의입니다.'
    };

    const first = await requestJson(router, '/contact', { method: 'POST', body });
    const second = await requestJson(router, '/contact', { method: 'POST', body });

    assert.equal(first.status, 201);
    assert.equal(second.status, 409);
    assert.equal(second.body.message, '같은 문의가 이미 접수되었습니다.');
    assert.equal(createdPayloads.length, 1);
    assert.equal(createdPayloads[0].email, 'person@example.com');
    assert.equal(createdPayloads[0].message, '같은 문의입니다.');
});

test('public contact claims duplicate key before create completes', async () => {
    const createdPayloads = [];
    let resolveCreate;
    const createBlock = new Promise((resolve) => {
        resolveCreate = resolve;
    });
    const router = loadPublicRoute({
        CacheUtils: createCacheStub(),
        ContactMessages: {
            countRecentByIp: async () => 0,
            create: async (payload) => {
                createdPayloads.push(payload);
                await createBlock;
                return 42;
            }
        }
    });
    const body = {
        name: '홍길동',
        email: 'person@example.com',
        subject: '문의',
        message: '동시 문의입니다.'
    };
    const server = await startRouterServer(router);

    try {
        const first = postJson(server.baseUrl, '/contact', body);
        await waitFor(() => createdPayloads.length === 1);
        const second = await postJson(server.baseUrl, '/contact', body);

        assert.equal(second.status, 409);
        assert.equal(createdPayloads.length, 1);

        resolveCreate();
        const firstResult = await first;

        assert.equal(firstResult.status, 201);
        assert.equal(createdPayloads.length, 1);
    } finally {
        resolveCreate?.();
        await server.close();
    }
});
