const test = require('node:test');
const assert = require('node:assert/strict');

const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const loadDbUtilsWithConnection = (connection) => {
    clearRootModules([
        ['models', 'db-utils.js'],
        ['db.js'],
        ['log.js'],
        ['utils', 'cache.js']
    ]);

    stubRootModule(['db.js'], {
        getConnection: async () => connection,
        execute: async () => [[]]
    });
    stubRootModule(['log.js'], createNoopLogger());
    stubRootModule(['utils', 'cache.js'], {
        get: () => undefined,
        set: () => true
    });

    return require(resolveFromRoot(['models', 'db-utils.js']));
};

test('executeTransaction commits and releases the connection on success', async () => {
    const events = [];
    const connection = {
        beginTransaction: async () => events.push('begin'),
        commit: async () => events.push('commit'),
        rollback: async () => events.push('rollback'),
        release: () => events.push('release')
    };
    const { executeTransaction } = loadDbUtilsWithConnection(connection);

    const result = await executeTransaction(async (activeConnection) => {
        assert.equal(activeConnection, connection);
        events.push('callback');
        return 123;
    });

    assert.equal(result, 123);
    assert.deepEqual(events, ['begin', 'callback', 'commit', 'release']);
});

test('executeTransaction rolls back and releases the connection on failure', async () => {
    const events = [];
    const connection = {
        beginTransaction: async () => events.push('begin'),
        commit: async () => events.push('commit'),
        rollback: async () => events.push('rollback'),
        release: () => events.push('release')
    };
    const { executeTransaction } = loadDbUtilsWithConnection(connection);

    await assert.rejects(
        () => executeTransaction(async () => {
            events.push('callback');
            throw new Error('write failed');
        }),
        /write failed/
    );

    assert.deepEqual(events, ['begin', 'callback', 'rollback', 'release']);
});
