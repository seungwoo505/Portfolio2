const {
    cacheKey,
    cached,
    stableStringify
} = require('./cache');

type PaginationInput = {
    page: number;
    limit: number;
};

type PaginatedResourceOptions<T> = {
    cachePrefix: string;
    cacheParts?: Array<string | number | boolean | null | undefined>;
    filters: Record<string, unknown>;
    loadItems: () => Promise<T[]> | T[];
    loadTotal: () => Promise<number> | number;
};

type SlugResourceOptions<T> = {
    cachePrefix: string;
    slug: string;
    loadResource: () => Promise<T> | T;
};

const buildPaginationMeta = ({ page, limit }: PaginationInput, total: number) => ({
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit)
});

const loadCachedPaginatedResource = async <T>({
    cachePrefix,
    cacheParts = [],
    filters,
    loadItems,
    loadTotal
}: PaginatedResourceOptions<T>): Promise<{ items: T[]; total: number }> => (
    await cached(cacheKey(cachePrefix, ...cacheParts, stableStringify(filters)), async () => {
        const [items, total] = await Promise.all([
            loadItems(),
            loadTotal()
        ]);

        return { items, total };
    })
);

const loadCachedSlugResource = async <T>({ cachePrefix, slug, loadResource }: SlugResourceOptions<T>): Promise<T> => (
    await cached(cacheKey(cachePrefix, 'slug', slug), loadResource)
);

module.exports = {
    buildPaginationMeta,
    loadCachedPaginatedResource,
    loadCachedSlugResource
};
