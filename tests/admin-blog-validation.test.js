const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAdminRoute, requestJson } = require('./helpers/admin-route-loader');

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

test('admin blog delete rejects malformed slug before model calls', async () => {
    let getBySlugAdminCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'blog.js'], [{
        segments: ['models', 'blog-posts.js'],
        moduleExports: {
            getBySlugAdmin: async () => {
                getBySlugAdminCalled = true;
                return null;
            },
            delete: async () => {}
        }
    }]);

    const { status, body } = await requestJson(router, '/blog/posts/slug/bad.slug', {
        method: 'DELETE'
    });

    assert.equal(status, 400);
    assert.equal(body.message, '유효한 slug가 필요합니다.');
    assert.equal(getBySlugAdminCalled, false);
});
