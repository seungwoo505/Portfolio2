const test = require('node:test');
const assert = require('node:assert/strict');

const {
    clearRootModules,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const normalizeSql = (query) => query.replace(/\s+/g, ' ').trim().toLowerCase();

const siteSettingsModules = [
    ['models', 'site-settings.ts'],
    ['models', 'site-settings', 'index.ts'],
    ['models', 'site-settings', 'common.ts'],
    ['models', 'site-settings', 'reads.ts'],
    ['models', 'site-settings', 'values.ts'],
    ['models', 'site-settings', 'writes.ts']
];

const loadSiteSettingsFixture = (existing = null) => {
    clearRootModules([
        ...siteSettingsModules,
        ['models', 'db-utils.ts']
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
                if (sql.includes('for update')) return [[...(existing ? [existing] : [])]];
                if (existing) return [[{ setting_key: params[0], ...existing }]];
                return [[{
                    setting_key: params[0],
                    setting_value: 'stored',
                    setting_type: 'string'
                }]];
            }

            if (sql.startsWith('insert into site_settings') && existing) {
                existing.setting_value = params[1];
                existing.setting_type = params[2];
                existing.is_public = params[3];
                if (sql.includes('description = coalesce(values(description), description)')) {
                    existing.description = params[4] ?? existing.description;
                } else if (sql.includes('description = values(description)')) {
                    existing.description = params[4];
                }
            }

            return [{ affectedRows: 1 }];
        }
    };

    stubRootModule(['models', 'db-utils.ts'], {
        executeQuery: async (query, params = []) => {
            return (await connection.execute(query, params))[0];
        },
        executeQuerySingle: async (query, params = []) => {
            return (await connection.execute(query, params))[0][0] || null;
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
        SiteSettings: require(resolveFromRoot(['models', 'site-settings.ts'])),
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

test('설정 설명은 명시적 null이면 삭제하고 생략하면 기존 값을 보존한다', async () => {
    const { normalizeSettingsPayload } = require('../routes/admin/settings/validation.ts');
    for (const [patch, expected] of [[{}, '기존 설명'], [{ description: null }, null], [{ description: ' 새 설명 ' }, '새 설명']]) {
        const fixture = loadSiteSettingsFixture({ setting_type: 'string', description: '기존 설명' });
        const normalized = normalizeSettingsPayload({ site_title: { value: 'Updated', ...patch } });
        const updated = await fixture.SiteSettings.setMany(normalized.settings);
        assert.equal(updated[0].description, expected);
    }
});

test('직접 설정 저장에서도 설명 생략과 명시적 null을 구분한다', async () => {
    const fixture = loadSiteSettingsFixture({ setting_type: 'string', description: '기존 설명' });
    assert.equal((await fixture.SiteSettings.set('site_title', 'Updated')).description, '기존 설명');
    assert.equal((await fixture.SiteSettings.set('site_title', 'Updated', 'string', false, null)).description, null);
});

test('값만 바꾸면 기존 설정의 숫자 타입과 공개 여부를 보존한다', async () => {
    const fixture = loadSiteSettingsFixture({ setting_type: 'number', is_public: 1, description: '목록 크기' });
    const { normalizeSettingsPayload } = require('../routes/admin/settings/validation.ts');
    const normalized = normalizeSettingsPayload({ page_size: { value: '20' } });
    assert.equal(normalized.error, undefined);
    await fixture.SiteSettings.setMany(normalized.settings);
    const insert = fixture.operations.find(operation => operation.sql.startsWith('insert'));
    assert.deepEqual(insert.params.slice(0, 4), ['page_size', '20', 'number', 1]);
});

test('타입을 생략해도 기존 숫자 설정에 빈 값을 저장할 수 없다', async () => {
    const fixture = loadSiteSettingsFixture({ setting_type: 'number', is_public: 1 });
    const { normalizeSettingsPayload } = require('../routes/admin/settings/validation.ts');
    const normalized = normalizeSettingsPayload({ page_size: { value: ' ' } });
    await assert.rejects(fixture.SiteSettings.setMany(normalized.settings), /숫자/);
    assert.equal(fixture.operations.some(operation => operation.sql.startsWith('insert')), false);
});

test('새 설정의 기본값과 기존 설정의 명시적 타입 및 공개 여부 변경을 지원한다', async () => {
    const fixture = loadSiteSettingsFixture();
    await fixture.SiteSettings.setMany({ new_setting: { value: 20 } });
    assert.deepEqual(fixture.operations.find(operation => operation.sql.startsWith('insert')).params,
        ['new_setting', '20', 'string', false, null]);
    const existing = loadSiteSettingsFixture({ setting_type: 'number', is_public: 1 });
    await existing.SiteSettings.setMany({ page_size: { value: 'twenty', type: 'string', is_public: false } });
    assert.deepEqual(existing.operations.find(operation => operation.sql.startsWith('insert')).params.slice(0, 4),
        ['page_size', 'twenty', 'string', false]);
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
        ...siteSettingsModules,
        ['models', 'db-utils.ts']
    ]);

    const nullableSetting = {
        setting_key: 'optional_banner',
        setting_value: null,
        setting_type: 'boolean',
        is_public: true,
        description: null,
        updated_at: '2026-05-25'
    };

    stubRootModule(['models', 'db-utils.ts'], {
        executeQuery: async () => [nullableSetting],
        executeQuerySingle: async () => nullableSetting,
        executeConnectionQuery: async () => [],
        executeConnectionQuerySingle: async () => null,
        executeTransaction: async (callback) => callback({
            execute: async () => [[nullableSetting]]
        })
    });

    const SiteSettings = require(resolveFromRoot(['models', 'site-settings.ts']));

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
