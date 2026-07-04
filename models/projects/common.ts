const {
    executeQuery,
    executeQuerySingle,
    executeConnectionQuery,
    executeConnectionQuerySingle,
    executeTransaction
} = require('../db-utils');
const { generateSlug, createUniqueSlug } = require('../../utils/slug');
const {
    toBooleanOrNull,
    toChoice,
    toCsvStringArray,
    toStringArray,
    toStringValue
} = require('../../utils/filter-values');

const createQueryContext = (connection) => ({
    query: (query, params = []) => executeConnectionQuery(connection, query, params),
    querySingle: (query, params = []) => executeConnectionQuerySingle(connection, query, params)
});

const defaultQueryContext = {
    query: executeQuery,
    querySingle: executeQuerySingle
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const normalizeOptionalUrl = (value) => (value === '' ? null : value);

const parseJsonField = (value) => {
    if (!value || typeof value !== 'string') {
        return value ?? null;
    }

    try {
        return JSON.parse(value);
    } catch (_error) {
        return value;
    }
};

const splitCsvField = (value) => {
    if (Array.isArray(value)) {
        return value;
    }

    if (!value || typeof value !== 'string') {
        return [];
    }

    return value
        .split(',')
        .map(item => item.trim())
        .filter(Boolean);
};

const pickFirstImageUrl = (images) => {
    if (!Array.isArray(images)) {
        return null;
    }

    for (const image of images) {
        if (typeof image === 'string' && image.trim()) {
            return image.trim();
        }

        if (image && typeof image === 'object' && typeof image.image_url === 'string' && image.image_url.trim()) {
            return image.image_url.trim();
        }
    }

    return null;
};

const pickFirstString = (...values) => {
    const value = values.find(item => typeof item === 'string' && item.trim());
    return value ? value.trim() : null;
};

const getStatusLabel = (status) => {
    if (status === 'completed') return '출시 완료';
    if (status === 'in_progress') return '제작 중';
    if (status === 'planning') return '기획 중';
    if (status === 'on_hold') return '보류';
    if (status === 'archived') return '보관됨';
    return '프로젝트';
};

const getPrimaryLinkUrl = (links, type) => {
    if (!Array.isArray(links)) {
        return null;
    }

    const link = links.find(item => item.link_type === type) ||
        links.find(item => item.type === type);
    return link?.url || null;
};

const mapProjectCatalogFields = (project) => {
    const isFeatured = Boolean(project.is_featured ?? project.featured);
    const catalogTitle = pickFirstString(
        project.custom_label,
        project.catalog_title,
        project.title
    );
    const catalogSummary = pickFirstString(
        project.custom_summary,
        project.catalog_summary,
        project.summary,
        project.description,
        project.meta_description,
        project.content_text
    );
    const imageUrl = pickFirstString(
        project.catalog_image_url,
        project.primary_image_url,
        project.image_url,
        pickFirstImageUrl(project.images)
    );
    const demoUrl = project.demo_url || getPrimaryLinkUrl(project.links, 'demo');
    const githubUrl = project.github_url || getPrimaryLinkUrl(project.links, 'github');
    const primaryMetric = project.primary_metric_label || project.primary_metric_value
        ? {
            label: project.primary_metric_label || null,
            value: project.primary_metric_value || null
        }
        : null;
    const catalog = {
        title: catalogTitle,
        summary: catalogSummary,
        label: pickFirstString(project.catalog_label) || (isFeatured ? '추천 프로젝트' : '프로젝트'),
        status: pickFirstString(project.catalog_status) || getStatusLabel(project.status),
        badge: project.catalog_badge || null,
        image_url: imageUrl,
        image_alt: project.primary_image_alt || null,
        accent_color: project.catalog_accent_color || null,
        cta_label: project.catalog_cta_label || '상세 보기',
        priority: Number(project.catalog_priority || 0),
        price_label: project.price_label || 'Portfolio',
        difficulty_label: project.difficulty_label || null,
        impact_summary: project.impact_summary || null,
        primary_metric: primaryMetric
    };

    return {
        ...project,
        content_json: parseJsonField(project.content_json),
        featured: isFeatured,
        demo_url: demoUrl,
        project_url: demoUrl,
        github_url: githubUrl,
        image_url: imageUrl || null,
        catalog,
        catalog_title: catalog.title,
        catalog_summary: catalog.summary,
        catalog_label: catalog.label,
        catalog_status: catalog.status,
        catalog_badge: catalog.badge,
        catalog_image_url: catalog.image_url,
        catalog_accent_color: catalog.accent_color,
        catalog_cta_label: catalog.cta_label,
        catalog_priority: catalog.priority,
        price_label: catalog.price_label,
        difficulty_label: catalog.difficulty_label,
        impact_summary: catalog.impact_summary,
        primary_metric_label: primaryMetric?.label || null,
        primary_metric_value: primaryMetric?.value || null
    };
};

const mapProjectListItem = (project) => ({
    ...mapProjectCatalogFields({
        ...project,
        long_description: project.content_text || project.description,
        skills: splitCsvField(project.skills),
        tags: splitCsvField(project.tags),
        images: splitCsvField(project.images)
    })
});

const mapProjectDetailItem = (project, relations: Record<string, any> = {}) => (
    mapProjectCatalogFields({
        ...project,
        long_description: project.content_text || project.description,
        metrics: relations.metrics || project.metrics || [],
        links: relations.links || project.links || [],
        sections: relations.sections || project.sections || [],
        related_posts: relations.related_posts || project.related_posts || [],
        skills: relations.skills || project.skills || [],
        images: relations.images || project.images || [],
        tags: relations.tags || project.tags || []
    })
);

module.exports = {
    createQueryContext,
    createUniqueSlug,
    defaultQueryContext,
    executeQuery,
    executeQuerySingle,
    executeTransaction,
    generateSlug,
    hasOwn,
    mapProjectCatalogFields,
    mapProjectDetailItem,
    mapProjectListItem,
    normalizeOptionalUrl,
    parseJsonField,
    pickFirstString,
    splitCsvField,
    toBooleanOrNull,
    toChoice,
    toCsvStringArray,
    toStringArray,
    toStringValue
};
export {};
