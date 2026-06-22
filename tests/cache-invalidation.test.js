const test = require('node:test');
const assert = require('node:assert/strict');

const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const blogPostModelModules = [
    ['models', 'blog-posts.ts'],
    ['models', 'blog-posts', 'index.ts'],
    ['models', 'blog-posts', 'common.ts'],
    ['models', 'blog-posts', 'detail.ts'],
    ['models', 'blog-posts', 'filters.ts'],
    ['models', 'blog-posts', 'list.ts'],
    ['models', 'blog-posts', 'mutations.ts'],
    ['models', 'blog-posts', 'search.ts'],
    ['models', 'blog-posts', 'tags.ts']
];

const cacheModules = [
    ['utils', 'cache.ts'],
    ['utils', 'cache', 'basic.ts'],
    ['utils', 'cache', 'batch.ts'],
    ['utils', 'cache', 'index.ts'],
    ['utils', 'cache', 'invalidation.ts'],
    ['utils', 'cache', 'loader.ts'],
    ['utils', 'cache', 'locks.ts'],
    ['utils', 'cache', 'store.ts']
];

test('resource invalidation clears public blog detail cache keys', () => {
    clearRootModules([
        ...cacheModules,
        ['log.ts']
    ]);

    stubRootModule(['log.ts'], createNoopLogger());

    const CacheUtils = require(resolveFromRoot(['utils', 'cache.ts']));
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
        ...blogPostModelModules,
        ['models', 'db-utils.ts'],
        ...cacheModules,
        ['utils', 'slug.js']
    ]);

    stubRootModule(['models', 'db-utils.ts'], {
        executeQuery: async () => [],
        executeQuerySingle: async () => null,
        executeConnectionQuery: async () => [],
        executeConnectionQuerySingle: async () => null,
        executeTransaction: async () => null
    });
    stubRootModule(['utils', 'cache.ts'], {
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

    const BlogPosts = require(resolveFromRoot(['models', 'blog-posts.ts']));
    BlogPosts.invalidateCache();

    assert.deepEqual(invalidations, [['blog', 'tags']]);
});

test('cacheApiResponse reuses an in-flight loader for the same key', async () => {
    clearRootModules([
        ...cacheModules,
        ['log.ts']
    ]);

    stubRootModule(['log.ts'], createNoopLogger());

    const CacheUtils = require(resolveFromRoot(['utils', 'cache.ts']));
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
