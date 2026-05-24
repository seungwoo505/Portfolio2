const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');

const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const requestJson = async (router, path, { method = 'GET', body = null } = {}) => {
    const app = express();
    app.use(express.json());
    app.use(router);

    const server = await new Promise((resolve) => {
        const activeServer = app.listen(0, '127.0.0.1', () => resolve(activeServer));
    });

    try {
        const { port } = server.address();
        const response = await fetch(`http://127.0.0.1:${port}${path}`, {
            method,
            headers: body ? { 'Content-Type': 'application/json' } : undefined,
            body: body ? JSON.stringify(body) : undefined
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

const loadAdminRoute = (routeSegments, moduleStubs) => {
    clearRootModules([
        routeSegments,
        ['routes', 'admin', 'common.js'],
        ['utils', 'cache.js'],
        ['middleware', 'auth.js'],
        ['log.js'],
        ...moduleStubs.map(({ segments }) => segments)
    ]);

    stubRootModule(['routes', 'admin', 'common.js'], {
        logger: createNoopLogger(),
        verboseDebug: () => {},
        buildErrorLog: (error) => ({ error: error.message })
    });
    stubRootModule(['utils', 'cache.js'], { invalidateResources: () => 0 });
    stubRootModule(['middleware', 'auth.js'], {
        authenticateToken: (req, _res, next) => {
            req.admin = { id: 1, role: 'super_admin' };
            next();
        },
        requirePermission: () => (_req, _res, next) => next(),
        logActivity: () => (_req, _res, next) => next()
    });

    moduleStubs.forEach(({ segments, moduleExports }) => {
        stubRootModule(segments, moduleExports);
    });

    return require(resolveFromRoot(routeSegments));
};

test('admin blog create rejects blank required strings', async () => {
    let createCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'blog.js'], [{
        segments: ['models', 'blog-posts.js'],
        moduleExports: {
            create: async () => {
                createCalled = true;
                return 1;
            }
        }
    }]);

    const { status, body } = await requestJson(router, '/blog/posts', {
        method: 'POST',
        body: {
            title: '   ',
            content: '본문'
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, '제목과 내용은 필수입니다.');
    assert.equal(createCalled, false);
});

test('admin project create trims required strings before model call', async () => {
    const createdPayloads = [];
    const router = loadAdminRoute(['routes', 'admin', 'projects.js'], [{
        segments: ['models', 'projects.js'],
        moduleExports: {
            create: async (payload) => {
                createdPayloads.push(payload);
                return 3;
            },
            getById: async (id) => ({ id })
        }
    }]);

    const { status } = await requestJson(router, '/projects', {
        method: 'POST',
        body: {
            title: '  포트폴리오  ',
            description: '  관리자 서버  '
        }
    });

    assert.equal(status, 201);
    assert.deepEqual(createdPayloads, [{
        title: '포트폴리오',
        description: '관리자 서버'
    }]);
});

test('admin interest create requires category', async () => {
    let createCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'interests.js'], [{
        segments: ['models', 'interests.js'],
        moduleExports: {
            create: async () => {
                createCalled = true;
                return { id: 1 };
            }
        }
    }]);

    const { status, body } = await requestJson(router, '/interests', {
        method: 'POST',
        body: {
            title: '운영 자동화'
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, '제목과 카테고리는 필수입니다.');
    assert.equal(createCalled, false);
});

test('admin tag update rejects blank provided name', async () => {
    let updateCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'tags.js'], [{
        segments: ['models', 'tags.js'],
        moduleExports: {
            update: async () => {
                updateCalled = true;
                return { id: 7 };
            }
        }
    }]);

    const { status, body } = await requestJson(router, '/tags/7', {
        method: 'PUT',
        body: {
            name: '   '
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, '태그 이름은 비어 있을 수 없습니다.');
    assert.equal(updateCalled, false);
});

test('admin social link create trims required strings before model call', async () => {
    const createdPayloads = [];
    const router = loadAdminRoute(['routes', 'admin', 'profile.js'], [
        {
            segments: ['models', 'personal-info.js'],
            moduleExports: {}
        },
        {
            segments: ['models', 'social-links.js'],
            moduleExports: {
                create: async (payload) => {
                    createdPayloads.push(payload);
                    return 11;
                },
                getById: async (id) => ({ id })
            }
        }
    ]);

    const { status } = await requestJson(router, '/social-links', {
        method: 'POST',
        body: {
            platform: '  GitHub  ',
            url: '  https://github.com/example  '
        }
    });

    assert.equal(status, 201);
    assert.deepEqual(createdPayloads, [{
        platform: 'GitHub',
        url: 'https://github.com/example'
    }]);
});
