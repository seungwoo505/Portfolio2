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

const pickProjectSummary = (project) => {
    const summary = [
        project.excerpt,
        project.short_description,
        project.description,
        project.meta_description,
        project.content_text,
        project.detailed_description,
        project.content
    ].find(value => typeof value === 'string' && value.trim());

    return summary ? summary.trim().slice(0, 220) : null;
};

const getCatalogStatus = (status) => {
    if (status === 'completed') return '출시 완료';
    if (status === 'in_progress') return '제작 중';
    if (status === 'planning') return '기획 중';
    if (status === 'on_hold') return '보류';
    return '프로젝트';
};

const mapProjectCatalogFields = (project) => {
    const demoUrl = project.demo_url || project.project_url || null;
    const imageUrl = project.image_url ||
        project.featured_image ||
        project.thumbnail_image ||
        pickFirstImageUrl(project.images);
    const isFeatured = Boolean(project.is_featured ?? project.featured);

    return {
        ...project,
        demo_url: demoUrl,
        project_url: demoUrl,
        image_url: imageUrl || null,
        featured: isFeatured,
        catalog_summary: pickProjectSummary(project),
        catalog_label: isFeatured ? '추천 프로젝트' : '프로젝트',
        catalog_status: getCatalogStatus(project.status)
    };
};

const mapProjectListItem = (project) => ({
    ...mapProjectCatalogFields({
        ...project,
        long_description: project.content_text || project.content || project.detailed_description,
        skills: splitCsvField(project.skills),
        tags: splitCsvField(project.tags),
        images: splitCsvField(project.images)
    })
});

const mapProjectDetailItem = (project, relations: Record<string, any> = {}) => (
    mapProjectCatalogFields({
        ...project,
        long_description: project.content_text || project.content || project.detailed_description,
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
    splitCsvField,
    toBooleanOrNull,
    toChoice,
    toCsvStringArray,
    toStringArray,
    toStringValue
};
export {};
