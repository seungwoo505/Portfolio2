const test = require('node:test');
const assert = require('node:assert/strict');
const { requestJson } = require('./helpers/http-route-server');
const { loadPublicRoute } = require('./helpers/public-route-loader');

test('public project list rejects invalid featured filters before model calls', async () => {
    let getWithFiltersCalled = false;
    const router = loadPublicRoute({
        Projects: {
            getWithFilters: async () => {
                getWithFiltersCalled = true;
                return [];
            },
            getCountWithFilters: async () => 0
        }
    });

    const { status, body } = await requestJson(router, '/projects?featured=maybe');

    assert.equal(status, 400);
    assert.equal(body.message, 'featured 값은 boolean이어야 합니다.');
    assert.equal(getWithFiltersCalled, false);
});

test('public project catalog returns database-backed catalog sections', async () => {
    const sectionLimits = [];
    const router = loadPublicRoute({
        Projects: {
            getCatalogSections: async (limit) => {
                sectionLimits.push(limit);
                return [{
                    id: 1,
                    title: '추천 프로젝트',
                    slug: 'featured-projects',
                    type: 'featured',
                    items: [{ id: 10, title: '프로젝트' }],
                    total: 1
                }];
            }
        }
    });

    const { status, body } = await requestJson(router, '/projects/catalog?limit=50');

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.sectionLimit, 12);
    assert.deepEqual(
        body.data.sections.map(section => section.slug),
        ['featured-projects']
    );
    assert.equal(body.data.sections[0].items.length, 1);
    assert.deepEqual(sectionLimits, [12]);
});

test('public project catalog falls back for partially numeric limits', async () => {
    const sectionLimits = [];
    const router = loadPublicRoute({
        Projects: {
            getCatalogSections: async (limit) => {
                sectionLimits.push(limit);
                return [];
            }
        }
    });

    const { status, body } = await requestJson(router, '/projects/catalog?limit=7abc');

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.data.sectionLimit, 4);
    assert.deepEqual(sectionLimits, [4]);
});

test('public post list rejects invalid featured filters before model calls', async () => {
    let getWithFiltersCalled = false;
    const router = loadPublicRoute({
        BlogPosts: {
            getWithFilters: async () => {
                getWithFiltersCalled = true;
                return [];
            },
            getCountWithFilters: async () => 0
        }
    });

    const { status, body } = await requestJson(router, '/posts?featured=maybe');

    assert.equal(status, 400);
    assert.equal(body.message, 'featured 값은 boolean이어야 합니다.');
    assert.equal(getWithFiltersCalled, false);
});

test('public tag list rejects invalid popular filters before model calls', async () => {
    let getAllCalled = false;
    let getPopularCalled = false;
    const router = loadPublicRoute({
        Tags: {
            getAll: async () => {
                getAllCalled = true;
                return [];
            },
            getPopular: async () => {
                getPopularCalled = true;
                return [];
            }
        }
    });

    const { status, body } = await requestJson(router, '/tags?popular=maybe');

    assert.equal(status, 400);
    assert.equal(body.message, 'popular 값은 boolean이어야 합니다.');
    assert.equal(getAllCalled, false);
    assert.equal(getPopularCalled, false);
});

test('public project detail rejects malformed slugs before lookup', async () => {
    let getBySlugCalled = false;
    const router = loadPublicRoute({
        Projects: {
            getBySlug: async () => {
                getBySlugCalled = true;
                return { id: 1, is_published: 1 };
            }
        }
    });

    const { status, body } = await requestJson(router, '/projects/bad.slug');

    assert.equal(status, 400);
    assert.equal(body.message, '유효한 slug가 필요합니다.');
    assert.equal(getBySlugCalled, false);
});

test('public post view rejects malformed slugs before lookup', async () => {
    let getBySlugCalled = false;
    let incrementCalled = false;
    const router = loadPublicRoute({
        BlogPosts: {
            getBySlug: async () => {
                getBySlugCalled = true;
                return { id: 1 };
            },
            incrementView: async () => {
                incrementCalled = true;
            }
        }
    });

    const { status, body } = await requestJson(router, '/posts/bad.slug/view', {
        method: 'POST'
    });

    assert.equal(status, 400);
    assert.equal(body.message, '유효한 slug가 필요합니다.');
    assert.equal(getBySlugCalled, false);
    assert.equal(incrementCalled, false);
});
