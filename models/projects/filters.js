const {
    toBooleanOrNull,
    toChoice,
    toStringArray,
    toStringValue
} = require('./common');

const normalizeProjectFilters = (filters = {}) => {
    const {
        limit = 10,
        offset = 0,
        search = '',
        tags = [],
        skills = [],
        featured = null,
        status = 'published',
        sort = 'created_at',
        order = 'desc',
        published_only = true
    } = filters;

    return {
        limit,
        offset,
        publishedOnly: published_only,
        search: toStringValue(search).trim(),
        tags: toStringArray(tags),
        skills: toStringArray(skills),
        featured: toBooleanOrNull(featured),
        status: toChoice(status, ['published', 'draft', 'all'], 'published'),
        sort: toChoice(sort, ['created_at', 'title', 'view_count', 'display_order'], 'created_at'),
        order: toChoice(order, ['asc', 'desc'], 'desc')
    };
};

const appendProjectFilterConditions = (normalizedFilters) => {
    const whereConditions = [];
    const queryParams = [];

    if (normalizedFilters.status === 'published') {
        whereConditions.push('p.is_published = 1');
    } else if (normalizedFilters.status === 'draft') {
        whereConditions.push('p.is_published = 0');
    } else if (normalizedFilters.publishedOnly) {
        whereConditions.push('p.is_published = 1');
    }

    if (normalizedFilters.featured !== null) {
        whereConditions.push('p.is_featured = ?');
        queryParams.push(normalizedFilters.featured ? 1 : 0);
    }

    if (normalizedFilters.tags.length > 0) {
        const tagPlaceholders = normalizedFilters.tags.map(() => '?').join(',');
        whereConditions.push(`
            p.id IN (
                SELECT tu.content_id
                FROM tag_usage tu
                INNER JOIN tags t ON tu.tag_id = t.id
                WHERE tu.content_type = 'project'
                AND t.slug IN (${tagPlaceholders})
            )
        `);
        queryParams.push(...normalizedFilters.tags);
    }

    if (normalizedFilters.skills.length > 0) {
        const skillPlaceholders = normalizedFilters.skills.map(() => '?').join(',');
        whereConditions.push(`
            p.id IN (
                SELECT ps.project_id
                FROM project_skills ps
                INNER JOIN skills s ON ps.skill_id = s.id
                WHERE s.name IN (${skillPlaceholders})
            )
        `);
        queryParams.push(...normalizedFilters.skills);
    }

    if (normalizedFilters.search) {
        const searchTerm = `%${normalizedFilters.search}%`;
        whereConditions.push(`(
            p.title LIKE ? OR
            p.short_description LIKE ? OR
            p.detailed_description LIKE ? OR
            p.content LIKE ? OR
            p.technologies LIKE ?
        )`);
        queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    return {
        queryParams,
        whereClause: whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    };
};

const buildProjectOrderClause = ({ sort, order }) => {
    if (sort === 'display_order') {
        return 'ORDER BY p.is_featured DESC, p.display_order ASC, p.created_at DESC';
    }

    return `ORDER BY p.is_featured DESC, p.${sort} ${order.toUpperCase()}`;
};

module.exports = {
    appendProjectFilterConditions,
    buildProjectOrderClause,
    normalizeProjectFilters
};
