const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const {
    executeQuery,
    executeQuerySingle,
    executeConnectionQuery,
    executeConnectionQuerySingle,
    executeTransaction
} = require('../db-utils');
const logger = require('../../log');
const { parseIntegerEnv } = require('../../utils/env-number');

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);
const createQueryContext = (connection) => ({
    query: (query, params = []) => executeConnectionQuery(connection, query, params),
    querySingle: (query, params = []) => executeConnectionQuerySingle(connection, query, params)
});
const defaultQueryContext = {
    query: executeQuery,
    querySingle: executeQuerySingle
};

module.exports = {
    bcrypt,
    crypto,
    createQueryContext,
    defaultQueryContext,
    executeQuery,
    executeQuerySingle,
    executeTransaction,
    hasOwn,
    jwt,
    logger,
    parseIntegerEnv
};
export {};
