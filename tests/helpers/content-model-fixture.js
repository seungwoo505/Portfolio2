const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./module-loader');

const normalizeSql = (query) => query.replace(/\s+/g, ' ').trim().toLowerCase();

const projectModelModules = [
    ['models', 'projects.ts'],
    ['models', 'projects', 'index.ts'],
    ['models', 'projects', 'catalog-sections.ts'],
    ['models', 'projects', 'common.ts'],
    ['models', 'projects', 'detail.ts'],
    ['models', 'projects', 'filters.ts'],
    ['models', 'projects', 'list.ts'],
    ['models', 'projects', 'mutations.ts'],
    ['models', 'projects', 'relations.ts'],
    ['models', 'projects', 'slugs.ts']
];

const blogPostModelModules = [
    ['models', 'blog-posts.ts'],
    ['models', 'blog-posts', 'index.ts'],
    ['models', 'blog-posts', 'common.ts'],
    ['models', 'blog-posts', 'detail.ts'],
    ['models', 'blog-posts', 'filters.ts'],
    ['models', 'blog-posts', 'list.ts'],
    ['models', 'blog-posts', 'mutations.ts'],
    ['models', 'blog-posts', 'projects.ts'],
    ['models', 'blog-posts', 'search.ts'],
    ['models', 'blog-posts', 'tags.ts']
];

const getModelModules = (modelPath) => {
    if (modelPath.join('/') === 'models/blog-posts.ts') {
        return blogPostModelModules;
    }

    if (modelPath.join('/') === 'models/projects.ts') {
        return projectModelModules;
    }

    return [modelPath];
};

const createModelFixture = (modelPath) => {
    clearRootModules([
        ...getModelModules(modelPath),
        ['models', 'db-utils.ts'],
        ['utils', 'slug.js'],
        ['utils', 'cache.ts'],
        ['utils', 'filter-values.js'],
        ['log.ts']
    ]);

    const operations = [];
    let transactionCount = 0;
    let nextTagId = 500;

    const connection = {
        execute: async (query, params = []) => {
            const sql = normalizeSql(query);
            operations.push({ sql, params });

            if (sql.includes('insert into blog_posts')) {
                return [{ insertId: 101 }];
            }

            if (sql.includes('insert into projects')) {
                return [{ insertId: 201 }];
            }

            if (sql.startsWith('select id from projects where id = ?')) {
                return [[{ id: params[0] }]];
            }

            if (sql.startsWith('select id from projects where slug = ?')) {
                return [[{ id: 301 }]];
            }

            if (sql.includes('insert into tags')) {
                nextTagId += 1;
                return [{ insertId: nextTagId }];
            }

            if (sql.startsWith('select')) {
                return [[]];
            }

            return [{ affectedRows: 1 }];
        }
    };

    const dbUtils = {
        executeQuery: async (query, params = []) => {
            operations.push({ sql: `pool:${normalizeSql(query)}`, params });
            return [];
        },
        executeQuerySingle: async (query, params = []) => {
            operations.push({ sql: `pool-single:${normalizeSql(query)}`, params });
            return null;
        },
        executeConnectionQuery: async (activeConnection, query, params = []) => {
            const [result] = await activeConnection.execute(query, params);
            return result;
        },
        executeConnectionQuerySingle: async (activeConnection, query, params = []) => {
            const [result] = await activeConnection.execute(query, params);
            return result[0] || null;
        },
        executeTransaction: async (callback) => {
            transactionCount += 1;
            return await callback(connection);
        }
    };

    stubRootModule(['models', 'db-utils.ts'], dbUtils);
    stubRootModule(['utils', 'slug.js'], {
        generateSlug: (value, fallback = 'item') => (
            String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || fallback
        ),
        createUniqueSlug: async ({ value, providedSlug, fallback, exists }) => {
            const candidate = providedSlug || `${fallback}-slug`;
            await exists(candidate);
            return candidate;
        }
    });
    stubRootModule(['utils', 'cache.ts'], {
        delPattern: () => 0,
        invalidateResources: () => 0,
        generateKey: (...parts) => parts.join(':'),
        cacheApiResponse: async (_key, fetcher) => fetcher()
    });
    stubRootModule(['log.ts'], createNoopLogger());

    const model = require(resolveFromRoot(modelPath));
    return {
        model,
        operations,
        get transactionCount() {
            return transactionCount;
        }
    };
};

const hasOperation = (operations, fragment) => (
    operations.some((operation) => operation.sql.includes(fragment))
);

module.exports = {
    createModelFixture,
    hasOperation
};
