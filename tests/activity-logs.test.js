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
        ['models', 'admin-activity-logs.js'],
        ['models', 'db-utils.js']
    ]);

    const queries = [];

    stubRootModule(['models', 'db-utils.js'], {
        executeQuery: async (query, params = []) => {
            queries.push({ sql: normalizeSql(query), params });
            return { insertId: 11, affectedRows: 3 };
        },
        executeQuerySingle: async (query, params = []) => {
            queries.push({ sql: normalizeSql(query), params });
            if (normalizeSql(query).includes('total_activities')) {
                return { total_activities: 5 };
            }
            return { total: 0 };
        }
    });

    return {
        ActivityLogs: require(resolveFromRoot(['models', 'activity-logs.js'])),
        AdminActivityLogs: require(resolveFromRoot(['models', 'admin-activity-logs.js'])),
        queries
    };
};

test('AdminActivityLogs reuses the unified activity log model', async () => {
    const fixture = loadActivityLogsFixture();

    assert.equal(fixture.AdminActivityLogs, fixture.ActivityLogs);

    const id = await fixture.AdminActivityLogs.log(1, 'create_project', 'projects', 20, 'created', '127.0.0.1', 'macOS | Chrome');

    const insertQuery = fixture.queries.find((query) => query.sql.startsWith('insert into admin_activity_logs'));
    assert.equal(id, 11);
    assert.ok(insertQuery);
    assert.deepEqual(insertQuery.params, [1, 'create_project', 'projects', 20, 'created', '127.0.0.1', 'macOS | Chrome']);
});

test('ActivityLogs.getStats keeps dashboard and log-list stats shapes', async () => {
    const fixture = loadActivityLogsFixture();

    const dashboardStats = await fixture.ActivityLogs.getStats(7);
    const listStats = await fixture.ActivityLogs.getStats();

    assert.deepEqual(dashboardStats, { total_activities: 5 });
    assert.equal(fixture.queries[0].sql.includes('date_sub(now(), interval ? day)'), true);
    assert.deepEqual(fixture.queries[0].params, [7]);
    assert.deepEqual(listStats, { total: 0 });
    assert.deepEqual(fixture.queries[1].params, []);
});

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
