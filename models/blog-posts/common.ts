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
const { withContentTags } = require('../content-tags');
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
    tags: post.tags || []
});

const mapBlogPostListItems = async (posts) => (
    (await withContentTags(posts, 'blog_post', executeQuery)).map(mapBlogPostListItem)
);

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
    mapBlogPostListItems,
    normalizeTagNames,
    toBooleanOrNull,
    toChoice,
    toStringArray,
    toStringValue
};
export {};
