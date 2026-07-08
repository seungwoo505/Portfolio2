const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAdminRoute, requestJson } = require('./helpers/admin-route-loader');

test('admin blog create rejects blank required strings', async () => {
    let createCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'blog.ts'], [{
        segments: ['models', 'blog-posts.ts'],
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

test('admin blog create accepts block content text without legacy markdown', async () => {
    let createPayload = null;
    const router = loadAdminRoute(['routes', 'admin', 'blog.ts'], [{
        segments: ['models', 'blog-posts.ts'],
        moduleExports: {
            create: async (payload) => {
                createPayload = payload;
                return 1;
            },
            getById: async () => ({ id: 1 })
        }
    }]);

    const { status } = await requestJson(router, '/blog/posts', {
        method: 'POST',
        body: {
            title: '블록 글',
            content: '',
            content_text: '블록 에디터 본문',
            content_json: [{ type: 'paragraph', content: '블록 에디터 본문' }]
        }
    });

    assert.equal(status, 201);
    assert.equal(createPayload.content, '블록 에디터 본문');
    assert.equal(createPayload.content_text, '블록 에디터 본문');
});

test('admin blog delete rejects malformed slug before model calls', async () => {
    let getBySlugAdminCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'blog.ts'], [{
        segments: ['models', 'blog-posts.ts'],
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

test('admin blog project links reject duplicate projects before lookup', async () => {
    let getBySlugAdminCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'blog.ts'], [{
        segments: ['models', 'blog-posts.ts'],
        moduleExports: {
            getBySlugAdmin: async () => {
                getBySlugAdminCalled = true;
                return { id: 7 };
            }
        }
    }]);

    const { status, body } = await requestJson(router, '/blog/posts/slug/shop-post/projects', {
        method: 'PUT',
        body: {
            projects: [
                { slug: 'shop-portfolio' },
                'shop-portfolio'
            ]
        }
    });

    assert.equal(status, 400);
    assert.equal(body.message, 'projects에 동일한 프로젝트를 중복 입력할 수 없습니다.');
    assert.equal(getBySlugAdminCalled, false);
});

test('admin blog project links replace validated project links', async () => {
    const updateCalls = [];
    let invalidateCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'blog.ts'], [{
        segments: ['models', 'blog-posts.ts'],
        moduleExports: {
            getBySlugAdmin: async () => ({ id: 7, slug: 'shop-post' }),
            updateProjects: async (postId, projects) => {
                updateCalls.push({ postId, projects });
            },
            invalidateCache: () => {
                invalidateCalled = true;
            },
            getRelatedProjects: async () => [{ id: 3, slug: 'shop-portfolio' }]
        }
    }]);

    const { status, body } = await requestJson(router, '/blog/posts/slug/shop-post/projects', {
        method: 'PUT',
        body: {
            projects: [
                { project_id: '3', relation_label: '  구현 사례  ' },
                { slug: 'admin-dashboard', display_order: '4' }
            ]
        }
    });

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(invalidateCalled, true);
    assert.deepEqual(updateCalls, [{
        postId: 7,
        projects: [
            {
                project_id: 3,
                display_order: 0,
                relation_label: '구현 사례'
            },
            {
                slug: 'admin-dashboard',
                display_order: 4,
                relation_label: null
            }
        ]
    }]);
    assert.deepEqual(body.data, [{ id: 3, slug: 'shop-portfolio' }]);
});

test('admin blog project links list returns related projects', async () => {
    const router = loadAdminRoute(['routes', 'admin', 'blog.ts'], [{
        segments: ['models', 'blog-posts.ts'],
        moduleExports: {
            getBySlugAdmin: async () => ({ id: 7, slug: 'shop-post' }),
            getRelatedProjects: async (postId) => [{ postId, slug: 'shop-portfolio' }]
        }
    }]);

    const { status, body } = await requestJson(router, '/blog/posts/slug/shop-post/projects');

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(body.data, [{ postId: 7, slug: 'shop-portfolio' }]);
});
