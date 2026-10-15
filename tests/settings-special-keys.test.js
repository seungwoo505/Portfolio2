const test = require('node:test');
const assert = require('node:assert/strict');
const { clearRootModules, stubRootModule } = require('./helpers/module-loader');
const { loadAdminRoute, requestJson } = require('./helpers/admin-route-loader');
const { loadPublicRoute } = require('./helpers/public-route-loader');
const { requestJson: publicRequest } = require('./helpers/http-route-server');

function loadSettings(initialRows = []) {
    clearRootModules([
        ['models', 'site-settings.ts'], ['models', 'site-settings', 'index.ts'],
        ['models', 'site-settings', 'common.ts'], ['models', 'site-settings', 'reads.ts'],
        ['models', 'site-settings', 'writes.ts'], ['models', 'site-settings', 'values.ts']
    ]);
    const rows = new Map(initialRows.map(row => [row.setting_key, { ...row }]));
    const query = async (sql, params = []) => {
        const normalized = sql.replace(/\s+/g, ' ').trim().toLowerCase();
        if (normalized.startsWith('insert into site_settings')) {
            const [key, value, type, isPublic, description] = params;
            const previous = rows.get(key);
            rows.set(key, {
                setting_key: key, setting_value: value, setting_type: type,
                is_public: Number(isPublic),
                description: !previous || normalized.includes('description = values(description)')
                    ? description : previous.description,
                updated_at: '2026-10-15'
            });
            return { affectedRows: 1 };
        }
        if (normalized.startsWith('select * from site_settings where setting_key = ?')) {
            return rows.has(params[0]) ? [{ ...rows.get(params[0]) }] : [];
        }
        if (normalized.startsWith('select * from site_settings')) {
            return [...rows.values()]
                .filter(row => !normalized.includes('where is_public = true') || row.is_public === 1)
                .map(row => ({ ...row }));
        }
        throw new Error(`예상하지 못한 설정 SQL: ${normalized}`);
    };
    const connection = { execute: async (sql, params) => [await query(sql, params)] };
    stubRootModule(['models', 'db-utils.ts'], {
        executeQuery: query,
        executeQuerySingle: async (sql, params) => (await query(sql, params))[0] || null,
        executeConnectionQuery: async (conn, sql, params) => (await conn.execute(sql, params))[0],
        executeConnectionQuerySingle: async (conn, sql, params) => (await conn.execute(sql, params))[0][0] || null,
        executeTransaction: async callback => callback(connection)
    });
    return require('../models/site-settings.ts');
}

const storedSpecialSetting = {
    setting_key: '__proto__', setting_value: '{"marker":"원래 값"}',
    setting_type: 'json', is_public: 1, description: null, updated_at: '2026-10-15'
};

test('특수 이름 설정도 관리자 저장과 재조회에서 값을 보존한다', async () => {
    const SiteSettings = loadSettings();
    const router = loadAdminRoute(['routes', 'admin', 'settings.ts'], [{
        segments: ['models', 'site-settings.ts'], moduleExports: SiteSettings
    }]);
    const saved = await requestJson(router, '/settings', {
        method: 'PUT', body: { settings: JSON.parse('{' +
            '"__proto__":{"value":{"marker":"저장 값"},"type":"json","is_public":true},' +
            '"constructor":{"value":"일반 문자열","type":"string","is_public":true},' +
            '"toString":{"value":null,"type":"string","is_public":false}' +
        '}') }
    });
    assert.equal(saved.status, 200);
    const result = await requestJson(router, '/settings');
    assert.equal(result.status, 200);
    assert.equal(Object.hasOwn(result.body.data, '__proto__'), true);
    assert.deepEqual(result.body.data.__proto__.value, { marker: '저장 값' });
    assert.equal(result.body.data.constructor.value, '일반 문자열');
    assert.equal(result.body.data.toString.value, null);
});

test('기존 특수 이름 설정도 관리자 JSON 응답에서 누락하지 않는다', async () => {
    const SiteSettings = loadSettings([storedSpecialSetting]);
    const router = loadAdminRoute(['routes', 'admin', 'settings.ts'], [{
        segments: ['models', 'site-settings.ts'], moduleExports: SiteSettings
    }]);
    const result = await requestJson(router, '/settings');
    assert.equal(result.status, 200);
    assert.equal(Object.hasOwn(result.body.data, '__proto__'), true);
    assert.deepEqual(result.body.data.__proto__.value, { marker: '원래 값' });
});

test('공개 설정은 특수 이름 값을 보존하면서 비공개 설정은 제외한다', async () => {
    const SiteSettings = loadSettings([
        storedSpecialSetting,
        { ...storedSpecialSetting, setting_key: 'private_setting', is_public: 0 }
    ]);
    const router = loadPublicRoute({ SiteSettings });
    const result = await publicRequest(router, '/settings');
    assert.equal(result.status, 200);
    assert.deepEqual(Object.keys(result.body.data), ['__proto__']);
    assert.deepEqual(result.body.data.__proto__, { marker: '원래 값' });
});
