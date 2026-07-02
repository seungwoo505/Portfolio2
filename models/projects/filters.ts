const {
    toBooleanOrNull,
    toChoice,
    toStringArray,
    toStringValue
} = require('./common');

const normalizeProjectFilters = (filters: Record<string, any> = {}) => {
    const {
        limit = 10,
        offset = 0,
        search = '',
        tags = [],
        skills = [],
        project_type = [],
        types = [],
        featured = null,
        status = 'published',
        project_status = '',
        sort = 'created_at',
        order = 'desc',
        published_only = true
    } = filters;
    const rawStatus = toStringValue(status).trim().toLowerCase();
    const publicationStatus = ['published', 'draft', 'all'].includes(rawStatus)
        ? rawStatus
        : 'published';
    const lifecycleStatus = toChoice(
        project_status || (!['published', 'draft', 'all'].includes(rawStatus) ? rawStatus : ''),
        ['planning', 'in_progress', 'completed', 'on_hold', 'archived'],
        ''
    );

    return {
        limit,
        offset,
        publishedOnly: published_only,
        search: toStringValue(search).trim(),
        tags: toStringArray(tags),
        skills: toStringArray(skills),
        projectTypes: toStringArray(project_type).concat(toStringArray(types)),
        featured: toBooleanOrNull(featured),
        publicationStatus,
        lifecycleStatus,
        sort: toChoice(sort, ['catalog_priority', 'created_at', 'published_at', 'title', 'view_count', 'display_order'], 'created_at'),
        order: toChoice(order, ['asc', 'desc'], 'desc')
    };
};

const appendProjectFilterConditions = (normalizedFilters) => {
    const whereConditions = [];
    const queryParams = [];

    if (normalizedFilters.publicationStatus === 'published') {
        whereConditions.push('p.is_published = 1');
    } else if (normalizedFilters.publicationStatus === 'draft') {
        whereConditions.push('p.is_published = 0');
    } else if (normalizedFilters.publishedOnly) {
        whereConditions.push('p.is_published = 1');
    }

    if (normalizedFilters.lifecycleStatus) {
        whereConditions.push('p.status = ?');
        queryParams.push(normalizedFilters.lifecycleStatus);
    }

    if (normalizedFilters.featured !== null) {
        whereConditions.push('p.is_featured = ?');
        queryParams.push(normalizedFilters.featured ? 1 : 0);
    }

    if (normalizedFilters.projectTypes.length > 0) {
        const typePlaceholders = normalizedFilters.projectTypes.map(() => '?').join(',');
        whereConditions.push(`p.project_type IN (${typePlaceholders})`);
        queryParams.push(...normalizedFilters.projectTypes);
    }

    if (normalizedFilters.tags.length > 0) {
        const tagPlaceholders = normalizedFilters.tags.map(() => '?').join(',');
        whereConditions.push(`
            p.id IN (
                SELECT pt.project_id
                FROM project_tags pt
                INNER JOIN tags t ON pt.tag_id = t.id
                WHERE t.slug IN (${tagPlaceholders}) OR t.name IN (${tagPlaceholders})
            )
        `);
        queryParams.push(...normalizedFilters.tags);
        queryParams.push(...normalizedFilters.tags);
    }

    if (normalizedFilters.skills.length > 0) {
        const skillPlaceholders = normalizedFilters.skills.map(() => '?').join(',');
        whereConditions.push(`
            p.id IN (
                SELECT ps.project_id
                FROM project_skills ps
                INNER JOIN skills s ON ps.skill_id = s.id
                WHERE s.slug IN (${skillPlaceholders}) OR s.name IN (${skillPlaceholders})
            )
        `);
        queryParams.push(...normalizedFilters.skills);
        queryParams.push(...normalizedFilters.skills);
    }

    if (normalizedFilters.search) {
        const searchTerm = `%${normalizedFilters.search}%`;
        whereConditions.push(`(
            p.title LIKE ? OR
            p.summary LIKE ? OR
            p.description LIKE ? OR
            p.meta_description LIKE ? OR
            p.meta_keywords LIKE ? OR
            p.content_text LIKE ? OR
            cp.catalog_title LIKE ? OR
            cp.catalog_summary LIKE ? OR
            cp.catalog_label LIKE ? OR
            cp.impact_summary LIKE ?
        )`);
        queryParams.push(
            searchTerm,
            searchTerm,
            searchTerm,
            searchTerm,
            searchTerm,
            searchTerm,
            searchTerm,
            searchTerm,
            searchTerm,
            searchTerm
        );
    }

    return {
        queryParams,
        whereClause: whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : ''
    };
};

const buildProjectOrderClause = ({ sort, order }) => {
    if (sort === 'catalog_priority' || sort === 'display_order') {
        return 'ORDER BY p.is_featured DESC, cp.catalog_priority DESC, p.display_order ASC, COALESCE(p.published_at, p.created_at) DESC';
    }

    if (sort === 'published_at') {
        return `ORDER BY p.is_featured DESC, COALESCE(p.published_at, p.created_at) ${order.toUpperCase()}`;
    }

    return `ORDER BY p.is_featured DESC, p.${sort} ${order.toUpperCase()}`;
};

module.exports = {
    appendProjectFilterConditions,
    buildProjectOrderClause,
    normalizeProjectFilters
};
export {};
