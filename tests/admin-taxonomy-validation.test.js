const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAdminRoute, requestJson } = require('./helpers/admin-route-loader');

test('admin interest list normalizes array category filters before model calls', async () => {
    const requestedCategories = [];
    const router = loadAdminRoute(['routes', 'admin', 'interests.js'], [{
        segments: ['models', 'interests.js'],
        moduleExports: {
            getByCategory: async (category) => {
                requestedCategories.push(category);
                return [];
            },
            getAll: async () => []
        }
    }]);

    const { status } = await requestJson(router, '/interests?category=dev&category=music');

    assert.equal(status, 200);
    assert.deepEqual(requestedCategories, ['dev']);
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

test('admin tag list rejects invalid popular filters before model calls', async () => {
    let getAllCalled = false;
    let getPopularCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'tags.js'], [{
        segments: ['models', 'tags.js'],
        moduleExports: {
            getAll: async () => {
                getAllCalled = true;
                return [];
            },
            getPopular: async () => {
                getPopularCalled = true;
                return [];
            }
        }
    }]);

    const { status, body } = await requestJson(router, '/tags?popular=maybe');

    assert.equal(status, 400);
    assert.equal(body.message, 'popular 값은 boolean이어야 합니다.');
    assert.equal(getAllCalled, false);
    assert.equal(getPopularCalled, false);
});

test('admin tag delete rejects invalid ids before model calls', async () => {
    let getByIdCalled = false;
    let deleteCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'tags.js'], [{
        segments: ['models', 'tags.js'],
        moduleExports: {
            getById: async () => {
                getByIdCalled = true;
                return { id: 7 };
            },
            delete: async () => {
                deleteCalled = true;
            }
        }
    }]);

    const { status, body } = await requestJson(router, '/tags/not-a-number', {
        method: 'DELETE'
    });

    assert.equal(status, 400);
    assert.equal(body.message, '유효한 태그 ID가 필요합니다.');
    assert.equal(getByIdCalled, false);
    assert.equal(deleteCalled, false);
});
