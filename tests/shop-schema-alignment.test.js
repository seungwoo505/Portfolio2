const test = require('node:test');
const assert = require('node:assert/strict');
const {
    clearRootModules,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const normalizeSql = (query) => query.replace(/\s+/g, ' ').trim().toLowerCase();

const createDbStub = () => {
    const operations = [];

    const dbUtils = {
        executeQuery: async (query, params = []) => {
            operations.push({ sql: normalizeSql(query), params });
            return { insertId: 101, affectedRows: 1 };
        },
        executeQuerySingle: async (query, params = []) => {
            operations.push({ sql: normalizeSql(query), params });
            if (normalizeSql(query).startsWith('select * from personal_info')) {
                return {
                    display_name: 'Tester',
                    full_name: 'Tester',
                    headline: 'Builder'
                };
            }
            if (normalizeSql(query).includes('coalesce(max(display_order)')) {
                return { next_order: 1 };
            }
            return null;
        }
    };

    return { operations, dbUtils };
};

const stubSlugHelpers = () => {
    stubRootModule(['utils', 'slug.ts'], {
        generateSlug: (value, fallback = 'item') => (
            String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || fallback
        ),
        createUniqueSlug: async ({ value, providedSlug, fallback }) => (
            providedSlug || String(value || fallback).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
        )
    });
};

test('PersonalInfo writes shop profile columns and keeps response aliases', async () => {
    const { operations, dbUtils } = createDbStub();
    clearRootModules([
        ['models', 'personal-info.ts'],
        ['models', 'db-utils.ts']
    ]);
    stubRootModule(['models', 'db-utils.ts'], dbUtils);

    const PersonalInfo = require(resolveFromRoot(['models', 'personal-info.ts']));
    const profile = await PersonalInfo.update({
        name: 'Tester',
        title: 'Builder'
    });

    const insertOperation = operations.find(operation => operation.sql.startsWith('insert into personal_info'));
    assert.ok(insertOperation);
    assert.equal(insertOperation.sql.includes('display_name'), true);
    assert.equal(insertOperation.sql.includes('headline'), true);
    assert.equal(insertOperation.params[0], 'Tester');
    assert.equal(insertOperation.params[1], 'Tester');
    assert.equal(insertOperation.params[2], 'Builder');
    assert.equal(profile.name, 'Tester');
    assert.equal(profile.title, 'Builder');
});

test('SocialLinks persists optional label column', async () => {
    const { operations, dbUtils } = createDbStub();
    clearRootModules([
        ['models', 'social-links.ts'],
        ['models', 'db-utils.ts']
    ]);
    stubRootModule(['models', 'db-utils.ts'], dbUtils);

    const SocialLinks = require(resolveFromRoot(['models', 'social-links.ts']));
    await SocialLinks.create({
        platform: 'GitHub',
        label: 'Code',
        url: 'https://github.com/example'
    });

    const insertOperation = operations.find(operation => operation.sql.startsWith('insert into social_links'));
    assert.ok(insertOperation);
    assert.equal(insertOperation.sql.includes('platform, label, url'), true);
    assert.deepEqual(insertOperation.params.slice(0, 3), ['GitHub', 'Code', 'https://github.com/example']);
});

test('Skills and categories create required slugs for shop schema', async () => {
    const { operations, dbUtils } = createDbStub();
    clearRootModules([
        ['models', 'skills.ts'],
        ['models', 'skills', 'index.ts'],
        ['models', 'skills', 'common.ts'],
        ['models', 'skills', 'categories.ts'],
        ['models', 'skills', 'mutations.ts'],
        ['models', 'skills', 'queries.ts'],
        ['models', 'db-utils.ts'],
        ['utils', 'slug.ts']
    ]);
    stubRootModule(['models', 'db-utils.ts'], dbUtils);
    stubSlugHelpers();

    const Skills = require(resolveFromRoot(['models', 'skills.ts']));
    await Skills.createCategory({ name: 'Frontend' });
    await Skills.createSkill({ category_id: 1, name: 'React' });

    const categoryInsert = operations.find(operation => operation.sql.startsWith('insert into skill_categories'));
    const skillInsert = operations.find(operation => operation.sql.startsWith('insert into skills'));

    assert.ok(categoryInsert);
    assert.equal(categoryInsert.sql.includes('name, slug, description, display_order'), true);
    assert.deepEqual(categoryInsert.params.slice(0, 2), ['Frontend', 'frontend']);

    assert.ok(skillInsert);
    assert.equal(skillInsert.sql.includes('name, slug, proficiency_level'), true);
    assert.deepEqual(skillInsert.params.slice(0, 3), [1, 'React', 'react']);
});

test('Tags use project_tags for project usage operations', async () => {
    const { operations, dbUtils } = createDbStub();
    clearRootModules([
        ['models', 'tags.ts'],
        ['models', 'tags', 'index.ts'],
        ['models', 'tags', 'mutations.ts'],
        ['models', 'tags', 'queries.ts'],
        ['models', 'tags', 'usage.ts'],
        ['models', 'db-utils.ts'],
        ['utils', 'slug.ts']
    ]);
    stubRootModule(['models', 'db-utils.ts'], dbUtils);
    stubSlugHelpers();

    const Tags = require(resolveFromRoot(['models', 'tags.ts']));
    await Tags.delete(7);
    await Tags.updateUsageCounts();

    assert.equal(operations.some(operation => operation.sql.includes('delete from project_tags where tag_id = ?')), true);
    assert.equal(operations.some(operation => operation.sql.includes('from project_tags group by tag_id')), true);
    assert.equal(operations.some(operation => operation.sql.includes('tag_usage')), false);
});
