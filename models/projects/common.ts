const {
    executeQuery,
    executeQuerySingle,
    executeConnectionQuery,
    executeConnectionQuerySingle,
    executeTransaction
} = require('../db-utils');
const { generateSlug, createUniqueSlug } = require('../../utils/slug');
const { withContentTags } = require('../content-tags');
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

const mapProjectListItem = (project) => ({
    ...project,
    featured: Boolean(project.is_featured),
    long_description: project.content_text || project.content || project.detailed_description,
    skills: project.skills || [],
    tags: project.tags || [],
    images: project.images || []
});

const normalizeTagNames = (value) => (
    Array.isArray(value) ? toStringArray(value) : toCsvStringArray(value)
);

const mapProjectListItems = async (projects) => {
    if (projects.length === 0) return [];

    // 스킬명은 쉼표를 포함할 수 있으므로 문자열 집계 대신 관계 행을 한 번에 읽는다.
    const ids = [...new Set(projects.map(project => project.id))];
    const placeholders = ids.map(() => '?').join(',');
    const skills = await executeQuery(`
        SELECT DISTINCT ps.project_id, s.name
        FROM project_skills ps
        INNER JOIN skills s ON s.id = ps.skill_id
        WHERE ps.project_id IN (${placeholders})
        ORDER BY s.name ASC
    `, ids);
    const namesByProject = new Map();
    for (const skill of skills) {
        if (!namesByProject.has(skill.project_id)) namesByProject.set(skill.project_id, []);
        namesByProject.get(skill.project_id).push(skill.name);
    }

    // URL에는 쉼표가 포함될 수 있어 집계 문자열 대신 원본 관계 행을 읽는다.
    const images = await executeQuery(`
        SELECT project_id, image_url
        FROM project_images
        WHERE project_id IN (${placeholders})
        ORDER BY display_order ASC, id ASC
    `, ids);
    const imagesByProject = new Map();
    for (const image of images) {
        if (!imagesByProject.has(image.project_id)) imagesByProject.set(image.project_id, new Set());
        imagesByProject.get(image.project_id).add(image.image_url);
    }

    const taggedProjects = await withContentTags(projects, 'project', executeQuery);
    return taggedProjects.map(project => mapProjectListItem({
        ...project,
        skills: namesByProject.get(project.id) || [],
        images: [...(imagesByProject.get(project.id) || [])]
    }));
};

module.exports = {
    createQueryContext,
    createUniqueSlug,
    defaultQueryContext,
    executeQuery,
    executeQuerySingle,
    executeTransaction,
    generateSlug,
    hasOwn,
    mapProjectListItem,
    mapProjectListItems,
    normalizeTagNames,
    normalizeOptionalUrl,
    toBooleanOrNull,
    toChoice,
    toCsvStringArray,
    toStringArray,
    toStringValue
};
export {};
