const {
    cacheKey,
    cached,
    stableStringify
} = require('./cache');

const buildPaginationMeta = ({ page, limit }, total) => ({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
});

const loadCachedPaginatedResource = async ({
    cachePrefix,
    cacheParts = [],
    filters,
    loadItems,
    loadTotal
}) => (
    await cached(cacheKey(cachePrefix, ...cacheParts, stableStringify(filters)), async () => {
        const [items, total] = await Promise.all([
            loadItems(),
            loadTotal()
        ]);

        return { items, total };
    })
);

const loadCachedSlugResource = async ({ cachePrefix, slug, loadResource }) => (
    await cached(cacheKey(cachePrefix, 'slug', slug), loadResource)
);

module.exports = {
    buildPaginationMeta,
    loadCachedPaginatedResource,
    loadCachedSlugResource
};
