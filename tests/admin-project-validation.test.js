const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAdminRoute, requestJson } = require('./helpers/admin-route-loader');

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

test('admin project detail rejects malformed slug before model calls', async () => {
    let getBySlugCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'projects.js'], [{
        segments: ['models', 'projects.js'],
        moduleExports: {
            getBySlug: async () => {
                getBySlugCalled = true;
                return null;
            }
        }
    }]);

    const { status, body } = await requestJson(router, '/projects/slug/bad.slug');

    assert.equal(status, 400);
    assert.equal(body.message, '유효한 slug가 필요합니다.');
    assert.equal(getBySlugCalled, false);
});
