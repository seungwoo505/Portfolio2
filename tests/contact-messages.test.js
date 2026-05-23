const test = require('node:test');
const assert = require('node:assert/strict');

const {
    clearRootModules,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const normalizeSql = (query) => query.replace(/\s+/g, ' ').trim().toLowerCase();

const createContactMessagesFixture = () => {
    clearRootModules([
        ['models', 'contact-messages.js'],
        ['models', 'db-utils.js']
    ]);

    const operations = [];
    stubRootModule(['models', 'db-utils.js'], {
        executeQuery: async (query, params = []) => {
            operations.push({ sql: normalizeSql(query), params });
            return [];
        },
        executeQuerySingle: async (query, params = []) => {
            operations.push({ sql: normalizeSql(query), params });
            return { total: 7 };
        }
    });

    return {
        model: require(resolveFromRoot(['models', 'contact-messages.js'])),
        operations
    };
};

test('ContactMessages.getUnread binds pagination limit and offset', async () => {
    const fixture = createContactMessagesFixture();

    await fixture.model.getUnread(25, 50);

    assert.equal(fixture.operations[0].sql.includes('where is_read = false'), true);
    assert.equal(fixture.operations[0].sql.includes('limit ? offset ?'), true);
    assert.deepEqual(fixture.operations[0].params, [25, 50]);
});

test('ContactMessages.countAll can count unread messages', async () => {
    const fixture = createContactMessagesFixture();

    const total = await fixture.model.countAll({ unread: true });

    assert.equal(total, 7);
    assert.equal(fixture.operations[0].sql.includes('where is_read = false'), true);
    assert.deepEqual(fixture.operations[0].params, []);
});
