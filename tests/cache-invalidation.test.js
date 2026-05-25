const test = require('node:test');
const assert = require('node:assert/strict');

const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

test('resource invalidation clears public blog detail cache keys', () => {
    clearRootModules([
        ['utils', 'cache.js'],
        ['log.js']
    ]);

    stubRootModule(['log.js'], createNoopLogger());

    const CacheUtils = require(resolveFromRoot(['utils', 'cache.js']));
    CacheUtils.flush();

    try {
        CacheUtils.set('blog_post:public:slug:post-a', { id: 1 });
        CacheUtils.set('blog_posts:public:{}', [{ id: 1 }]);
        CacheUtils.set('unrelated:public:post-a', true);

        CacheUtils.invalidateResources('blog');

        assert.equal(CacheUtils.has('blog_post:public:slug:post-a'), false);
        assert.equal(CacheUtils.has('blog_posts:public:{}'), false);
        assert.equal(CacheUtils.has('unrelated:public:post-a'), true);
    } finally {
        CacheUtils.flush();
    }
});

test('BlogPosts.invalidateCache uses resource invalidation for blog and tags', () => {
    const invalidations = [];

    clearRootModules([
        ['models', 'blog-posts.js'],
        ['models', 'db-utils.js'],
        ['utils', 'cache.js'],
        ['utils', 'slug.js']
    ]);

    stubRootModule(['models', 'db-utils.js'], {
        executeQuery: async () => [],
        executeQuerySingle: async () => null,
        executeConnectionQuery: async () => [],
        executeConnectionQuerySingle: async () => null,
        executeTransaction: async () => null
    });
    stubRootModule(['utils', 'cache.js'], {
        invalidateResources: (...resources) => {
            invalidations.push(resources);
            return 0;
        },
        generateKey: (...parts) => parts.join(':'),
        cacheApiResponse: async (_key, fetcher) => fetcher()
    });
    stubRootModule(['utils', 'slug.js'], {
        createUniqueSlug: async () => 'post-a'
    });

    const BlogPosts = require(resolveFromRoot(['models', 'blog-posts.js']));
    BlogPosts.invalidateCache();

    assert.deepEqual(invalidations, [['blog', 'tags']]);
});

test('cacheApiResponse reuses an in-flight loader for the same key', async () => {
    clearRootModules([
        ['utils', 'cache.js'],
        ['log.js']
    ]);

    stubRootModule(['log.js'], createNoopLogger());

    const CacheUtils = require(resolveFromRoot(['utils', 'cache.js']));
    CacheUtils.flush();

    let loaderCalls = 0;
    let resolveLoader;
    const loaderBlock = new Promise((resolve) => {
        resolveLoader = resolve;
    });

    try {
        const first = CacheUtils.cacheApiResponse('shared:profile', async () => {
            loaderCalls += 1;
            await loaderBlock;
            return { name: 'Tester' };
        });
        const second = CacheUtils.cacheApiResponse('shared:profile', async () => {
            loaderCalls += 1;
            return { name: 'Duplicate' };
        });

        assert.equal(loaderCalls, 1);
        resolveLoader();

        const [firstResult, secondResult] = await Promise.all([first, second]);
        assert.deepEqual(firstResult, { name: 'Tester' });
        assert.deepEqual(secondResult, { name: 'Tester' });

        const cachedResult = await CacheUtils.cacheApiResponse('shared:profile', async () => {
            loaderCalls += 1;
            return { name: 'Cached' };
        });

        assert.deepEqual(cachedResult, { name: 'Tester' });
        assert.equal(loaderCalls, 1);
    } finally {
        CacheUtils.flush();
    }
});
