const test = require('node:test');
const assert = require('node:assert/strict');

const {
    clearRootModules,
    createNoopLogger,
    resolveFromRoot,
    stubRootModule
} = require('./helpers/module-loader');

const loadDbUtilsWithConnection = (connection, {
    logger = createNoopLogger(),
    execute = async () => [[]]
} = {}) => {
    clearRootModules([
        ['models', 'db-utils.js'],
        ['db.js'],
        ['log.js'],
        ['utils', 'cache.js']
    ]);

    stubRootModule(['db.js'], {
        getConnection: async () => connection,
        execute
    });
    stubRootModule(['log.js'], logger);
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

test('executeQuery logs parameter counts without raw parameter values', async () => {
    const logs = [];
    const logger = {
        debug: (message, meta) => logs.push(['debug', message, meta]),
        database: (message, meta) => logs.push(['database', message, meta]),
        warn: (message, meta) => logs.push(['warn', message, meta]),
        error: (message, meta) => logs.push(['error', message, meta])
    };
    const { executeQuery } = loadDbUtilsWithConnection({}, {
        logger,
        execute: async () => [[{ id: 1 }]]
    });

    await executeQuery(
        'SELECT * FROM admin_users WHERE email = ? AND password_hash = ?',
        ['admin@example.com', 'password-hash-value']
    );

    const debugLog = logs.find(([level]) => level === 'debug');
    assert.ok(debugLog);
    assert.equal(debugLog[2].paramCount, 2);
    assert.equal(Object.prototype.hasOwnProperty.call(debugLog[2], 'params'), false);

    const serializedLogs = JSON.stringify(logs);
    assert.equal(serializedLogs.includes('admin@example.com'), false);
    assert.equal(serializedLogs.includes('password-hash-value'), false);
});

test('executeQuery failure logs parameter counts without raw parameter values', async () => {
    const logs = [];
    const logger = {
        debug: (message, meta) => logs.push(['debug', message, meta]),
        database: (message, meta) => logs.push(['database', message, meta]),
        warn: (message, meta) => logs.push(['warn', message, meta]),
        error: (message, meta) => logs.push(['error', message, meta])
    };
    const { executeQuery } = loadDbUtilsWithConnection({}, {
        logger,
        execute: async () => {
            throw new Error('write failed');
        }
    });

    await assert.rejects(
        () => executeQuery(
            'UPDATE admin_sessions SET refresh_token_hash = ? WHERE session_id = ?',
            ['refresh-token-hash-value', 'session-id-value']
        ),
        /write failed/
    );

    const errorLog = logs.find(([level]) => level === 'error');
    assert.ok(errorLog);
    assert.equal(errorLog[2].paramCount, 2);
    assert.equal(Object.prototype.hasOwnProperty.call(errorLog[2], 'params'), false);

    const serializedLogs = JSON.stringify(logs);
    assert.equal(serializedLogs.includes('refresh-token-hash-value'), false);
    assert.equal(serializedLogs.includes('session-id-value'), false);
});
