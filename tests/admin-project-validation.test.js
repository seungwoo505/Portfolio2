const test = require('node:test');
const assert = require('node:assert/strict');
const { loadAdminRoute, requestJson } = require('./helpers/admin-route-loader');

test('admin project create trims required strings before model call', async () => {
    const createdPayloads = [];
    const router = loadAdminRoute(['routes', 'admin', 'projects.ts'], [{
        segments: ['models', 'projects.ts'],
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

test('admin project create accepts block content text without explicit description', async () => {
    const createdPayloads = [];
    const router = loadAdminRoute(['routes', 'admin', 'projects.ts'], [{
        segments: ['models', 'projects.ts'],
        moduleExports: {
            create: async (payload) => {
                createdPayloads.push(payload);
                return 4;
            },
            getById: async (id) => ({ id })
        }
    }]);

    const { status } = await requestJson(router, '/projects', {
        method: 'POST',
        body: {
            title: '블록 프로젝트',
            content_text: '블록 기반 프로젝트 설명입니다.',
            content_html: '<p>블록 기반 프로젝트 설명입니다.</p>'
        }
    });

    assert.equal(status, 201);
    assert.equal(createdPayloads[0].description, '블록 기반 프로젝트 설명입니다.');
    assert.equal(createdPayloads[0].content_html, '<p>블록 기반 프로젝트 설명입니다.</p>');
});

test('admin project create preserves shop catalog payload fields', async () => {
    const createdPayloads = [];
    const router = loadAdminRoute(['routes', 'admin', 'projects.ts'], [{
        segments: ['models', 'projects.ts'],
        moduleExports: {
            create: async (payload) => {
                createdPayloads.push(payload);
                return 5;
            },
            getById: async (id) => ({ id })
        }
    }]);

    const { status } = await requestJson(router, '/projects', {
        method: 'POST',
        body: {
            catalog_title: '  쇼핑몰형 포트폴리오  ',
            catalog_summary: '  프로젝트를 상품처럼 탐색하는 화면입니다.  ',
            catalog_status: '제작 중'
        }
    });

    assert.equal(status, 201);
    assert.equal(createdPayloads[0].title, '쇼핑몰형 포트폴리오');
    assert.equal(createdPayloads[0].summary, '프로젝트를 상품처럼 탐색하는 화면입니다.');
    assert.equal(createdPayloads[0].description, '프로젝트를 상품처럼 탐색하는 화면입니다.');
    assert.equal(createdPayloads[0].meta_description, '프로젝트를 상품처럼 탐색하는 화면입니다.');
    assert.equal(createdPayloads[0].status, 'in_progress');
    assert.deepEqual(createdPayloads[0].catalog, {
        title: '쇼핑몰형 포트폴리오',
        summary: '프로젝트를 상품처럼 탐색하는 화면입니다.',
        status: '제작 중'
    });
});

test('admin project update accepts catalog summary without base description', async () => {
    const updatedPayloads = [];
    const router = loadAdminRoute(['routes', 'admin', 'projects.ts'], [{
        segments: ['models', 'projects.ts'],
        moduleExports: {
            getBySlug: async () => ({ id: 8, slug: 'shop-portfolio' }),
            update: async (_id, payload) => {
                updatedPayloads.push(payload);
                return { id: 8, ...payload };
            }
        }
    }]);

    const { status } = await requestJson(router, '/projects/slug/shop-portfolio', {
        method: 'PUT',
        body: {
            catalog_summary: '카탈로그 카드에 표시할 요약입니다.',
            catalog_status: '출시 완료'
        }
    });

    assert.equal(status, 200);
    assert.equal(updatedPayloads[0].summary, '카탈로그 카드에 표시할 요약입니다.');
    assert.equal(updatedPayloads[0].description, '카탈로그 카드에 표시할 요약입니다.');
    assert.equal(updatedPayloads[0].status, 'completed');
    assert.deepEqual(updatedPayloads[0].catalog, {
        summary: '카탈로그 카드에 표시할 요약입니다.',
        status: '출시 완료'
    });
});

test('admin project detail rejects malformed slug before model calls', async () => {
    let getBySlugCalled = false;
    const router = loadAdminRoute(['routes', 'admin', 'projects.ts'], [{
        segments: ['models', 'projects.ts'],
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
