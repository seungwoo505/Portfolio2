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

const mapProjectListItem = (project) => ({
    ...project,
    featured: Boolean(project.is_featured),
    long_description: project.content_text || project.content || project.detailed_description,
    skills: project.skills ? project.skills.split(',') : [],
    tags: project.tags ? project.tags.split(',') : [],
    images: project.images ? project.images.split(',') : []
});

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
    normalizeOptionalUrl,
    toBooleanOrNull,
    toChoice,
    toCsvStringArray,
    toStringArray,
    toStringValue
};
