const crypto = require('crypto');
const {
    executeQuery,
    executeQuerySingle,
    executeConnectionQuery,
    executeConnectionQuerySingle,
    executeTransaction
} = require('../db-utils');
const CacheUtils = require('../../utils/cache');
const { createUniqueSlug } = require('../../utils/slug');
const {
    toBooleanOrNull,
    toChoice,
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

const mapBlogPostListItem = (post) => ({
    ...post,
    featured: Boolean(post.is_featured),
    tags: post.tags ? post.tags.split(',') : []
});

const normalizeTagNames = (tagNames) => {
    if (Array.isArray(tagNames)) return tagNames;
    if (typeof tagNames === 'string') return tagNames.split(',');
    return [];
};

module.exports = {
    CacheUtils,
    createQueryContext,
    createUniqueSlug,
    crypto,
    defaultQueryContext,
    executeQuery,
    executeQuerySingle,
    executeTransaction,
    mapBlogPostListItem,
    normalizeTagNames,
    toBooleanOrNull,
    toChoice,
    toStringArray,
    toStringValue
};
export {};
