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

const loadSkillsRoute = (Skills) => {
    clearRootModules([
        ['routes', 'admin', 'skills.js'],
        ['routes', 'admin', 'common.js'],
        ['models', 'skills.js'],
        ['utils', 'cache.js'],
        ['utils', 'filter-values.js'],
        ['middleware', 'auth.js'],
        ['log.js']
    ]);

    stubRootModule(['routes', 'admin', 'common.js'], {
        logger: createNoopLogger(),
        buildErrorLog: (error) => ({ error: error.message })
    });
    stubRootModule(['models', 'skills.js'], Skills);
    stubRootModule(['utils', 'cache.js'], { invalidateResources: () => 0 });
    stubRootModule(['middleware', 'auth.js'], {
        authenticateToken: (req, _res, next) => {
            req.admin = { id: 1, role: 'super_admin' };
            next();
        },
        requirePermission: () => (_req, _res, next) => next(),
        logActivity: () => (_req, _res, next) => next()
    });

    return require(resolveFromRoot(['routes', 'admin', 'skills.js']));
};

test('admin skills create normalizes numeric and boolean fields', async () => {
    const createdPayloads = [];
    const router = loadSkillsRoute({
        getByDisplayOrder: async () => null,
        createSkill: async (payload) => {
            createdPayloads.push(payload);
            return 9;
        },
        getSkillById: async (id) => ({ id })
    });

    const { status } = await requestJson(router, '/skills', {
        method: 'POST',
        body: {
            name: ' Node.js ',
            category_id: '3',
            proficiency_level: '80',
            years_of_experience: '2.5',
            icon: '',
            color: '#339933',
            display_order: '4',
            is_featured: 'true'
        }
    });

    assert.equal(status, 201);
    assert.deepEqual(createdPayloads, [{
        name: 'Node.js',
        category_id: 3,
        proficiency_level: 80,
        years_of_experience: 2.5,
        icon: null,
        color: '#339933',
        display_order: 4,
        is_featured: true
    }]);
});

test('admin skills update only writes provided fields', async () => {
    const updatedPayloads = [];
    const router = loadSkillsRoute({
        getSkillById: async (id) => ({
            id,
            is_featured: 0,
            display_order: 5
        }),
        getByDisplayOrder: async () => null,
        updateSkill: async (_id, payload) => {
            updatedPayloads.push(payload);
        }
    });

    const { status } = await requestJson(router, '/skills/9', {
        method: 'PUT',
        body: {
            proficiency_level: '70'
        }
    });

    assert.equal(status, 200);
    assert.deepEqual(updatedPayloads, [{ proficiency_level: 70 }]);
});

test('admin skills featured toggle normalizes boolean-like strings', async () => {
    const updatedPayloads = [];
    const router = loadSkillsRoute({
        getSkillById: async (id) => ({ id }),
        updateSkill: async (_id, payload) => {
            updatedPayloads.push(payload);
        }
    });

    const { status } = await requestJson(router, '/skills/9/featured', {
        method: 'PATCH',
        body: {
            is_featured: 'false'
        }
    });

    assert.equal(status, 200);
    assert.deepEqual(updatedPayloads, [{ is_featured: false }]);
});

test('admin skills order update normalizes numeric strings', async () => {
    const updatedPayloads = [];
    const router = loadSkillsRoute({
        getSkillById: async (id) => ({ id }),
        updateSkill: async (_id, payload) => {
            updatedPayloads.push(payload);
        }
    });

    const { status } = await requestJson(router, '/skills/9/order', {
        method: 'PATCH',
        body: {
            display_order: '7'
        }
    });

    assert.equal(status, 200);
    assert.deepEqual(updatedPayloads, [{ display_order: 7 }]);
});

test('admin skills featured toggle rejects invalid ids before model calls', async () => {
    let getSkillByIdCalled = false;
    let updateCalled = false;
    const router = loadSkillsRoute({
        getSkillById: async () => {
            getSkillByIdCalled = true;
            return { id: 9 };
        },
        updateSkill: async () => {
            updateCalled = true;
        }
    });

    const { status, body } = await requestJson(router, '/skills/not-a-number/featured', {
        method: 'PATCH',
        body: {
            is_featured: 'true'
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, '유효한 기술 스택 ID가 필요합니다.');
    assert.equal(getSkillByIdCalled, false);
    assert.equal(updateCalled, false);
});

test('admin skills order update maps missing skills to 404', async () => {
    let updateCalled = false;
    const router = loadSkillsRoute({
        getSkillById: async () => null,
        updateSkill: async () => {
            updateCalled = true;
        }
    });

    const { status, body } = await requestJson(router, '/skills/9/order', {
        method: 'PATCH',
        body: {
            display_order: '7'
        }
    });

    assert.equal(status, 404);
    assert.equal(body.message, '기술 스택을 찾을 수 없습니다.');
    assert.equal(updateCalled, false);
});
