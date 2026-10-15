const test = require('node:test');
const assert = require('node:assert/strict');
const { clearRootModules, createNoopLogger, stubRootModule } = require('./helpers/module-loader');
const { loadPublicRoute } = require('./helpers/public-route-loader');
const { requestJson, startRouterServer } = require('./helpers/http-route-server');

const createBlogFixture = ({ loadPost, incrementView = async () => {} }) => {
    stubRootModule(['log.ts'], createNoopLogger());
    const CacheUtils = require('../utils/cache.ts');
    CacheUtils.flush();
    clearRootModules([['models', 'blog-posts', 'detail.ts'], ['models', 'blog-posts', 'common.ts']]);
    stubRootModule(['models', 'blog-posts', 'common.ts'], {
        CacheUtils,
        executeQuerySingle: loadPost,
        executeQuery: async query => {
            if (query.startsWith('UPDATE')) await incrementView();
            return [];
        }
    });
    const BlogPosts = require('../models/blog-posts/detail.ts');
    return { CacheUtils, router: loadPublicRoute({ BlogPosts, CacheUtils }) };
};

test('조회수를 증가시킨 뒤 공개 글 상세와 관리자 캐시에도 최신 값이 반영된다', async () => {
    let views = 0;
    const { CacheUtils, router } = createBlogFixture({
        loadPost: async () => ({ id: 1, slug: 'post-a', is_published: 1, view_count: views }),
        incrementView: async () => { views += 1; }
    });
    try {
        CacheUtils.set('blog_post_admin:slug:post-a', { id: 1, view_count: 0 });
        CacheUtils.set('blog_posts:all:20:0:false', [{ id: 1, view_count: 0 }]);
        const before = await requestJson(router, '/posts/post-a');
        const increment = await requestJson(router, '/posts/post-a/view', { method: 'POST' });
        const after = await requestJson(router, '/posts/post-a');

        assert.equal(before.body.data.view_count, 0);
        assert.equal(increment.status, 200);
        assert.equal(after.body.data.view_count, 1);
        assert.equal(CacheUtils.has('blog_post_admin:slug:post-a'), false);
        assert.equal(CacheUtils.has('blog_posts:all:20:0:false'), false);
    } finally {
        CacheUtils.flush();
    }
});

test('조회 중 비공개로 전환한 글은 후속 요청에 노출되지 않는다', { timeout: 5000 }, async () => {
    let published = true;
    let releaseQuery;
    let markStarted;
    const started = new Promise(resolve => { markStarted = resolve; });
    const { CacheUtils, router } = createBlogFixture({
        loadPost: async () => {
            if (!published) return null;
            const snapshot = { id: 1, slug: 'post-a', is_published: 1, content: '이전 공개 내용' };
            markStarted();
            await new Promise(resolve => { releaseQuery = resolve; });
            return snapshot;
        }
    });
    const server = await startRouterServer(router);
    try {
        const first = fetch(`${server.baseUrl}/posts/post-a`);
        await started;
        published = false;
        CacheUtils.invalidateResources('blog');
        releaseQuery();
        await (await first).json();

        const after = await fetch(`${server.baseUrl}/posts/post-a`);
        assert.equal(after.status, 404);
        assert.equal((await after.json()).success, false);
    } finally {
        releaseQuery?.();
        CacheUtils.flush();
        await server.close();
    }
});
