const test = require('node:test');
const assert = require('node:assert/strict');

const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const normalizeSql = (query) => query.replace(/\s+/g, ' ').trim().toLowerCase();

const createModelFixture = (modelPath) => {
    clearRootModules([
        modelPath,
        ['models', 'db-utils.js'],
        ['utils', 'slug.js'],
        ['utils', 'cache.js'],
        ['log.js']
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

    stubRootModule(['models', 'db-utils.js'], dbUtils);
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
    stubRootModule(['utils', 'cache.js'], {
        delPattern: () => 0,
        invalidateResources: () => 0,
        generateKey: (...parts) => parts.join(':'),
        cacheApiResponse: async (_key, fetcher) => fetcher()
    });
    stubRootModule(['log.js'], createNoopLogger());

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

test('BlogPosts._create writes the post and tags inside one transaction connection', async () => {
    const fixture = createModelFixture(['models', 'blog-posts.js']);

    const postId = await fixture.model._create({
        title: '테스트 글',
        content: 'Node.js transaction test content',
        is_published: true,
        tags: ['Node.js', 'Backend']
    });

    assert.equal(postId, 101);
    assert.equal(fixture.transactionCount, 1);
    assert.equal(hasOperation(fixture.operations, 'insert into blog_posts'), true);
    assert.equal(hasOperation(fixture.operations, "delete from tag_usage where content_type = 'blog_post'"), true);
    assert.equal(hasOperation(fixture.operations, 'insert into tags'), true);
    assert.equal(hasOperation(fixture.operations, "insert ignore into tag_usage"), true);
    assert.equal(fixture.operations.some((operation) => operation.sql.startsWith('pool:')), false);
});

test('BlogPosts._delete removes post tag usage and recalculates tag counts in one transaction', async () => {
    const fixture = createModelFixture(['models', 'blog-posts.js']);

    await fixture.model._delete(10);

    assert.equal(fixture.transactionCount, 1);
    assert.equal(hasOperation(fixture.operations, "delete from tag_usage where content_type = 'blog_post'"), true);
    assert.equal(hasOperation(fixture.operations, 'delete from blog_posts where id = ?'), true);
    assert.equal(hasOperation(fixture.operations, 'update tags t left join'), true);
});

test('Projects.create writes the project and tags inside one transaction connection', async () => {
    const fixture = createModelFixture(['models', 'projects.js']);

    const projectId = await fixture.model.create({
        title: 'Portfolio API',
        description: '관리자 API',
        content: 'Project content',
        tags: ['Node.js', 'MySQL']
    });

    assert.equal(projectId, 201);
    assert.equal(fixture.transactionCount, 1);
    assert.equal(hasOperation(fixture.operations, 'insert into projects'), true);
    assert.equal(hasOperation(fixture.operations, "delete from tag_usage where content_type = 'project'"), true);
    assert.equal(hasOperation(fixture.operations, 'insert into tags'), true);
    assert.equal(hasOperation(fixture.operations, "insert ignore into tag_usage"), true);
    assert.equal(fixture.operations.some((operation) => operation.sql.startsWith('pool:')), false);
});

test('Projects.delete removes child rows and recalculates tag counts in one transaction', async () => {
    const fixture = createModelFixture(['models', 'projects.js']);

    await fixture.model.delete(20);

    assert.equal(fixture.transactionCount, 1);
    assert.equal(hasOperation(fixture.operations, 'delete from project_skills where project_id = ?'), true);
    assert.equal(hasOperation(fixture.operations, 'delete from project_images where project_id = ?'), true);
    assert.equal(hasOperation(fixture.operations, "delete from tag_usage where content_type = 'project'"), true);
    assert.equal(hasOperation(fixture.operations, 'delete from projects where id = ?'), true);
    assert.equal(hasOperation(fixture.operations, 'update tags t left join'), true);
});
