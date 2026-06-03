const {
    executeQuery,
    executeQuerySingle,
    executeConnectionQuery,
    executeConnectionQuerySingle,
    executeTransaction
} = require('../db-utils');

const createQueryContext = (connection) => ({
    query: (query, params = []) => executeConnectionQuery(connection, query, params),
    querySingle: (query, params = []) => executeConnectionQuerySingle(connection, query, params)
});

const defaultQueryContext = {
    query: executeQuery,
    querySingle: executeQuerySingle
};

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

module.exports = {
    createQueryContext,
    defaultQueryContext,
    executeQuery,
    executeQuerySingle,
    executeTransaction,
    hasOwn
};
