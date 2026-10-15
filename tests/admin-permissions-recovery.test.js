const test = require('node:test');
const assert = require('node:assert/strict');
const { clearRootModules, stubRootModule, createNoopLogger } = require('./helpers/module-loader');

const fixture = ({ column = 'admin_id', failOnce = false } = {}) => {
    clearRootModules([['models', 'admin-users', 'permissions.ts']]);
    let failed = false;
    let schemaQueries = 0;
    stubRootModule(['models', 'admin-users', 'common.ts'], {
        logger: createNoopLogger(),
        executeQuery: async () => [{ name: 'contacts.read' }],
        executeQuerySingle: async query => {
            if (query.includes('SHOW COLUMNS')) {
                schemaQueries++;
                if (failOnce && !failed && query.includes(`'${column}'`)) {
                    failed = true;
                    throw new Error('일시 DB 오류');
                }
                return column && query.includes(`'${column}'`) ? { Field: column } : null;
            }
            return query.includes('admin_user_permissions') ? { allowed: 1 } : null;
        }
    });
    const model = {
        ...require('../models/admin-users/permissions.ts'),
        getById: async () => ({ id: 1, role: 'editor' })
    };
    return { model, get schemaQueries() { return schemaQueries; } };
};

for (const column of ['admin_id', 'user_id']) {
    test(`${column} 조회의 일시 오류가 복구되면 직접 권한을 다시 확인한다`, async () => {
        const { model } = fixture({ column, failOnce: true });
        assert.equal(await model.hasPermission(1, 'contacts.read'), false);
        assert.equal(await model.hasPermission(1, 'contacts.read'), true);
        assert.deepEqual(await model.getDirectUserPermissions(1), [{ name: 'contacts.read' }]);
    });
}

test('확인된 권한 컬럼은 재사용하며 실제로 없는 컬럼과 오류를 구분한다', async () => {
    const found = fixture();
    assert.equal(await found.model.hasPermission(1, 'contacts.read'), true);
    assert.equal(await found.model.hasPermission(1, 'contacts.read'), true);
    assert.equal(found.schemaQueries, 1);
    const missing = fixture({ column: null });
    assert.equal(await missing.model.hasPermission(1, 'contacts.read'), false);
    assert.equal(await missing.model.hasPermission(1, 'contacts.read'), false);
    assert.equal(missing.schemaQueries, 2);
});
