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

test('public project filter options returns project filter metadata', async () => {
    let getFilterOptionsCalled = false;
    const router = loadPublicRoute({
        Projects: {
            getFilterOptions: async () => {
                getFilterOptionsCalled = true;
                return {
                    projectTypes: [{ value: 'backend', label: 'Backend' }],
                    skills: [{ id: 1, name: 'Express' }],
                    tags: [{ id: 2, name: 'api' }]
                };
            }
        }
    });

    const { status, body } = await requestJson(router, '/projects/filter-options');

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(getFilterOptionsCalled, true);
    assert.deepEqual(body.data.projectTypes, [{ value: 'backend', label: 'Backend' }]);
    assert.deepEqual(body.data.skills, [{ id: 1, name: 'Express' }]);
});

test('public related projects rejects malformed slugs before model calls', async () => {
    let getRelatedProjectsCalled = false;
    const router = loadPublicRoute({
        Projects: {
            getRelatedProjects: async () => {
                getRelatedProjectsCalled = true;
                return [];
            }
        }
    });

    const { status, body } = await requestJson(router, '/projects/bad.slug/related');

    assert.equal(status, 400);
    assert.equal(body.message, '유효한 slug가 필요합니다.');
    assert.equal(getRelatedProjectsCalled, false);
});

test('public related projects clamps limit and maps missing source project to 404', async () => {
    const relatedCalls = [];
    const router = loadPublicRoute({
        Projects: {
            getRelatedProjects: async (slug, limit) => {
                relatedCalls.push({ slug, limit });
                return null;
            }
        }
    });

    const { status, body } = await requestJson(router, '/projects/shop-portfolio/related?limit=30');

    assert.equal(status, 404);
    assert.equal(body.message, '프로젝트를 찾을 수 없습니다.');
    assert.deepEqual(relatedCalls, [{ slug: 'shop-portfolio', limit: 12 }]);
});

test('public related projects returns item payloads with normalized fallback limit', async () => {
    const relatedCalls = [];
    const router = loadPublicRoute({
        Projects: {
            getRelatedProjects: async (slug, limit) => {
                relatedCalls.push({ slug, limit });
                return [{ id: 2, title: 'Related Project' }];
            }
        }
    });

    const { status, body } = await requestJson(router, '/projects/shop-portfolio/related?limit=4abc');

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(relatedCalls, [{ slug: 'shop-portfolio', limit: 4 }]);
    assert.deepEqual(body.data.items, [{ id: 2, title: 'Related Project' }]);
    assert.equal(body.data.limit, 4);
});

test('public project recommendations clamps limits and returns item payloads', async () => {
    const recommendationCalls = [];
    const router = loadPublicRoute({
        Projects: {
            getRecommendations: async (limit) => {
                recommendationCalls.push(limit);
                return [{ id: 3, title: 'Recommended Project' }];
            }
        }
    });

    const { status, body } = await requestJson(router, '/projects/recommendations?limit=30');

    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.deepEqual(recommendationCalls, [16]);
    assert.deepEqual(body.data.items, [{ id: 3, title: 'Recommended Project' }]);
    assert.equal(body.data.limit, 16);
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
