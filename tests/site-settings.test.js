const test = require('node:test');
const assert = require('node:assert/strict');

const {
    clearRootModules,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const normalizeSql = (query) => query.replace(/\s+/g, ' ').trim().toLowerCase();

const loadSiteSettingsFixture = () => {
    clearRootModules([
        ['models', 'site-settings.js'],
        ['models', 'db-utils.js']
    ]);

    const operations = [];
    let transactionCount = 0;
    const recordOperation = (query, params = []) => {
        const operation = { sql: normalizeSql(query), params };
        operations.push(operation);
        return operation;
    };
    const connection = {
        execute: async (query, params = []) => {
            const { sql } = recordOperation(query, params);

            if (sql.startsWith('select * from site_settings')) {
                return [[{
                    setting_key: params[0],
                    setting_value: 'stored',
                    setting_type: 'string'
                }]];
            }

            return [{ affectedRows: 1 }];
        }
    };

    stubRootModule(['models', 'db-utils.js'], {
        executeQuery: async (query, params = []) => {
            recordOperation(query, params);
            return [];
        },
        executeQuerySingle: async (query, params = []) => {
            const { sql } = recordOperation(query, params);
            if (sql.startsWith('select * from site_settings')) {
                return {
                    setting_key: params[0],
                    setting_value: 'stored',
                    setting_type: 'string'
                };
            }
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
    });

    return {
        SiteSettings: require(resolveFromRoot(['models', 'site-settings.js'])),
        operations,
        get transactionCount() {
            return transactionCount;
        }
    };
};

test('SiteSettings.setMany stores all settings through one transaction connection', async () => {
    const fixture = loadSiteSettingsFixture();

    const result = await fixture.SiteSettings.setMany({
        site_title: {
            value: 'Portfolio',
            type: 'string',
            is_public: true,
            description: '사이트 제목'
        },
        feature_flags: {
            value: { ai: true },
            type: 'json',
            is_public: false
        }
    });

    const insertOperations = fixture.operations.filter((operation) => operation.sql.startsWith('insert into site_settings'));
    assert.equal(fixture.transactionCount, 1);
    assert.equal(insertOperations.length, 2);
    assert.deepEqual(insertOperations[0].params, ['site_title', 'Portfolio', 'string', true, '사이트 제목']);
    assert.deepEqual(insertOperations[1].params, ['feature_flags', '{"ai":true}', 'json', false, null]);
    assert.equal(result.length, 2);
});

test('SiteSettings.setMany stores null setting values as database null', async () => {
    const fixture = loadSiteSettingsFixture();

    await fixture.SiteSettings.setMany({
        optional_banner: {
            value: null,
            type: 'string',
            is_public: true
        }
    });

    const insertOperation = fixture.operations.find((operation) => operation.sql.startsWith('insert into site_settings'));
    assert.ok(insertOperation);
    assert.deepEqual(insertOperation.params, ['optional_banner', null, 'string', true, null]);
});

test('SiteSettings getters preserve null setting values', async () => {
    clearRootModules([
        ['models', 'site-settings.js'],
        ['models', 'db-utils.js']
    ]);

    const nullableSetting = {
        setting_key: 'optional_banner',
        setting_value: null,
        setting_type: 'boolean',
        is_public: true,
        description: null,
        updated_at: '2026-05-25'
    };

    stubRootModule(['models', 'db-utils.js'], {
        executeQuery: async () => [nullableSetting],
        executeQuerySingle: async () => nullableSetting,
        executeConnectionQuery: async () => [],
        executeConnectionQuerySingle: async () => null,
        executeTransaction: async (callback) => callback({
            execute: async () => [[nullableSetting]]
        })
    });

    const SiteSettings = require(resolveFromRoot(['models', 'site-settings.js']));

    assert.equal(await SiteSettings.getValue('optional_banner'), null);
    assert.deepEqual(await SiteSettings.getPublicSettings(), {
        optional_banner: null
    });
    assert.deepEqual(await SiteSettings.getAllSettings(), {
        optional_banner: {
            value: null,
            type: 'boolean',
            is_public: true,
            description: null,
            updated_at: '2026-05-25'
        }
    });
});

test('SiteSettings.update can explicitly clear nullable values', async () => {
    const fixture = loadSiteSettingsFixture();

    await fixture.SiteSettings.update('hero.subtitle', {
        setting_value: null,
        description: null,
        is_public: false
    });

    const updateOperation = fixture.operations.find((operation) => operation.sql.startsWith('update site_settings'));
    assert.ok(updateOperation);
    assert.equal(updateOperation.sql.includes('coalesce'), false);
    assert.equal(updateOperation.sql.includes('setting_value = ?'), true);
    assert.equal(updateOperation.sql.includes('description = ?'), true);
    assert.equal(updateOperation.sql.includes('is_public = ?'), true);
    assert.deepEqual(updateOperation.params, [null, false, null, 'hero.subtitle']);
});
