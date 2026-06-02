const {
    toBooleanOrNull,
    toChoice,
    toStringArray,
    toStringValue
} = require('./common');

const normalizeBlogFilters = (filters = {}) => {
    const {
        limit = 10,
        offset = 0,
        search = '',
        tags = [],
        featured = null,
        status = 'published',
        sort = 'published_at',
        order = 'desc',
        published_only = true
    } = filters;

    return {
        limit,
        offset,
        publishedOnly: published_only,
        search: toStringValue(search).trim(),
        tags: toStringArray(tags),
        featured: toBooleanOrNull(featured),
        status: toChoice(status, ['published', 'draft', 'all'], 'published'),
        sort: toChoice(sort, ['published_at', 'created_at', 'title', 'view_count', 'reading_time'], 'published_at'),
        order: toChoice(order, ['asc', 'desc'], 'desc')
    };
};

const appendBlogFilterConditions = (normalizedFilters) => {
    const whereConditions = [];
    const queryParams = [];

    if (normalizedFilters.status === 'published') {
        whereConditions.push('bp.is_published = TRUE');
    } else if (normalizedFilters.status === 'draft') {
        whereConditions.push('bp.is_published = FALSE');
    } else if (normalizedFilters.publishedOnly) {
        whereConditions.push('bp.is_published = TRUE');
    }

    if (normalizedFilters.featured !== null) {
        whereConditions.push('bp.is_featured = ?');
        queryParams.push(normalizedFilters.featured ? 1 : 0);
    }

    if (normalizedFilters.tags.length > 0) {
        const tagPlaceholders = normalizedFilters.tags.map(() => '?').join(',');
        whereConditions.push(`
            bp.id IN (
                SELECT tu.content_id
                FROM tag_usage tu
                INNER JOIN tags t ON tu.tag_id = t.id
                WHERE tu.content_type = 'blog_post'
                AND t.slug IN (${tagPlaceholders})
            )
        `);
        queryParams.push(...normalizedFilters.tags);
    }

    if (normalizedFilters.search) {
        const searchTerm = `%${normalizedFilters.search}%`;
        whereConditions.push(`(
            bp.title LIKE ? OR
            bp.excerpt LIKE ? OR
            bp.content LIKE ? OR
            bp.meta_keywords LIKE ?
        )`);
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    return {
        queryParams,
        whereClause: whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    };
};

const buildBlogOrderClause = ({ sort, order }) => (
    `ORDER BY bp.is_featured DESC, bp.${sort} ${order.toUpperCase()}`
);

module.exports = {
    appendBlogFilterConditions,
    buildBlogOrderClause,
    normalizeBlogFilters
};
