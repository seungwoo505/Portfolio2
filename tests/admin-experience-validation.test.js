const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAdminRoute, requestJson } = require('./helpers/admin-route-loader');

test('admin experience list normalizes array type filters before model calls', async () => {
    const requestedTypes = [];
    const router = loadAdminRoute(['routes', 'admin', 'experiences.ts'], [{
        segments: ['models', 'experiences.ts'],
        moduleExports: {
            getByType: async (type) => {
                requestedTypes.push(type);
                return [];
            },
            getAll: async () => []
        }
    }]);

    const { status } = await requestJson(router, '/experiences?type=work&type=education');

    assert.equal(status, 200);
    assert.deepEqual(requestedTypes, ['work']);
});

test('admin experience delete maps missing experiences to 404 before delete', async () => {
    let deleteCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'experiences.ts'], [{
        segments: ['models', 'experiences.ts'],
        moduleExports: {
            getById: async () => null,
            delete: async () => {
                deleteCalled = true;
            }
        }
    }]);

    const { status, body } = await requestJson(router, '/experiences/4', {
        method: 'DELETE'
    });

    assert.equal(status, 404);
    assert.equal(body.message, '경력을 찾을 수 없습니다.');
    assert.equal(deleteCalled, false);
});
