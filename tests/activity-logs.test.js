const test = require('node:test');
const assert = require('node:assert/strict');

const {
    clearRootModules,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const normalizeSql = (query) => query.replace(/\s+/g, ' ').trim().toLowerCase();

const loadActivityLogsFixture = () => {
    clearRootModules([
        ['models', 'activity-logs.js'],
        ['models', 'db-utils.js']
    ]);

    const queries = [];

    stubRootModule(['models', 'db-utils.js'], {
        executeQuery: async (query, params = []) => {
            queries.push({ sql: normalizeSql(query), params });
            return [];
        },
        executeQuerySingle: async (query, params = []) => {
            queries.push({ sql: normalizeSql(query), params });
            return { total: 0 };
        }
    });

    return {
        ActivityLogs: require(resolveFromRoot(['models', 'activity-logs.js'])),
        queries
    };
};

test('ActivityLogs.findWithFilters uses parsed offset when provided', async () => {
    const fixture = loadActivityLogsFixture();

    await fixture.ActivityLogs.findWithFilters({
        limit: 20,
        offset: 40
    });

    const listQuery = fixture.queries.find((query) => query.sql.startsWith('select l.id'));
    assert.ok(listQuery);
    assert.equal(listQuery.sql.includes('limit ? offset ?'), true);
    assert.deepEqual(listQuery.params, [20, 40]);
});

test('ActivityLogs.findWithFilters clamps direct pagination calls', async () => {
    const fixture = loadActivityLogsFixture();

    await fixture.ActivityLogs.findWithFilters({
        limit: 50000,
        page: '-2'
    });

    const listQuery = fixture.queries.find((query) => query.sql.startsWith('select l.id'));
    assert.ok(listQuery);
    assert.deepEqual(listQuery.params, [10000, 0]);
});
